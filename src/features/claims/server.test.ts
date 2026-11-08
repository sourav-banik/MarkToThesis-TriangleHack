import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { defaultTerms } from "../../demo/claims";
import { instruments } from "../market-data/catalog";
import { liveClaimRequestSchema } from "./live-contracts";
import { commitLiveClaim, getLiveClaim } from "./server";
import type { ServerSupabase } from "@/lib/server/supabase";

const claimId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actor = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-11-07T18:00:00.123456+00:00";
const body = () =>
  liveClaimRequestSchema.parse({
    idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    originalText: "Apple will outperform SPY.",
    visibility: "private",
    terms: {
      ...defaultTerms,
      assumptions: [],
      instrument: instruments.aapl,
      prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
      horizon: { kind: "duration", value: 30, unit: "days" },
    },
  });
function mockClient() {
  const claims = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: claimId,
        author_id: actor,
        visibility: "private",
        initial_status: "awaiting_start",
        created_at: timestamp,
        supersedes_claim_id: null,
        claim_versions: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            claim_id: claimId,
            version: 1,
            original_text: body().originalText,
            terms: body().terms,
            market_bindings: { asset: { provider: "twelve_data", seriesId: "AAPL@NASDAQ" } },
            context: { kind: "live" },
            committed_at: timestamp,
          },
        ],
      },
      error: null,
    }),
  };
  const profiles = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: actor, handle: "investor", display_name: "Investor", bio: "" },
      error: null,
    }),
  };
  const rpc = vi.fn().mockResolvedValue({ data: claimId, error: null });
  const client = {
    rpc,
    from: vi.fn((table: string) => (table === "claims" ? claims : profiles)),
  } as unknown as ServerSupabase;
  return { client, rpc, claims, profiles };
}
beforeEach(() => vi.clearAllMocks());
describe("server commitment service", () => {
  it("passes only input terms to the RPC and preserves the exact database timestamp", async () => {
    const { client, rpc } = mockClient();
    const request = body();
    const result = await commitLiveClaim(client, request);
    expect(rpc).toHaveBeenCalledWith("commit_claim", {
      p_idempotency_key: request.idempotencyKey,
      p_original_text: request.originalText,
      p_terms: request.terms,
      p_visibility: "private",
      p_supersedes_claim_id: null,
    });
    expect(result.claim.version.committedAt).toBe(timestamp);
    expect(result.claim.version.authorId).toBe(actor);
    expect(result.claim.version.publishedAt).toBeNull();
    expect(result.claim.version.context).toEqual({ kind: "live" });
    expect(result.author).not.toHaveProperty("email");
  });
  it("returns the same not-found response for absent and hidden claims", async () => {
    const { client, claims } = mockClient();
    claims.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getLiveClaim(client, claimId)).rejects.toMatchObject({
      status: 404,
      message: "This claim is unavailable or private.",
    });
  });
  it("does not expose database error messages to the caller", async () => {
    const { client, rpc } = mockClient();
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "internal table and credential details" },
    });
    await expect(commitLiveClaim(client, body())).rejects.toMatchObject({ status: 503 });
    await expect(commitLiveClaim(client, body())).rejects.not.toThrow("credential details");
  });
  it("turns changed-body retry conflicts into an explicit conflict response", async () => {
    const { client, rpc } = mockClient();
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "Different body" } });
    await expect(commitLiveClaim(client, body())).rejects.toMatchObject({ status: 409 });
  });
});
