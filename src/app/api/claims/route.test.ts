import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/env", () => ({ getSupabaseConfig: () => null }));
vi.mock("@/features/auth/server", () => ({ requireAccount: vi.fn() }));
vi.mock("@/features/claims/server", async (original) => ({
  ...(await original<typeof import("@/features/claims/server")>()),
  commitLiveClaim: vi.fn(),
}));
import { requireAccount } from "@/features/auth/server";
import { commitLiveClaim } from "@/features/claims/server";
import { HttpError } from "@/lib/server/http";
import { defaultTerms } from "@/demo/claims";
import { instruments } from "@/features/market-data/catalog";
import { GET, POST } from "./route";

const body = () => ({
  idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  originalText: "AAPL will outperform SPY.",
  visibility: "private",
  terms: {
    ...defaultTerms,
    assumptions: [],
    instrument: instruments.aapl,
    prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
    horizon: { kind: "duration", value: 30, unit: "days" },
  },
});
function request(value: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/claims", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}
beforeEach(() => vi.clearAllMocks());
describe("claim HTTP boundary", () => {
  it("rejects cross-site submission before checking or using a session", async () => {
    expect((await POST(request(body(), "https://evil.example"))).status).toBe(403);
    expect(requireAccount).not.toHaveBeenCalled();
    expect(commitLiveClaim).not.toHaveBeenCalled();
  });
  it("does not invoke persistence for an unverified visitor", async () => {
    vi.mocked(requireAccount).mockRejectedValue(new HttpError(401, "Sign in to continue."));
    expect((await POST(request(body()))).status).toBe(401);
    expect(commitLiveClaim).not.toHaveBeenCalled();
  });
  it("does not accept client timestamps even from an authenticated user", async () => {
    vi.mocked(requireAccount).mockResolvedValue({
      client: {},
      user: { id: "11111111-1111-4111-8111-111111111111" },
      profile: null,
    } as unknown as Awaited<ReturnType<typeof requireAccount>>);
    expect((await POST(request({ ...body(), committedAt: "2020-01-01T00:00:00Z" }))).status).toBe(
      400,
    );
    expect(commitLiveClaim).not.toHaveBeenCalled();
  });
  it("forwards a stable retry key and no authority fields", async () => {
    const client = {};
    vi.mocked(requireAccount).mockResolvedValue({
      client,
      user: { id: "11111111-1111-4111-8111-111111111111" },
      profile: null,
    } as unknown as Awaited<ReturnType<typeof requireAccount>>);
    vi.mocked(commitLiveClaim).mockRejectedValue(new HttpError(503, "Retry safely."));
    await POST(request(body()));
    await POST(request(body()));
    const first = vi.mocked(commitLiveClaim).mock.calls[0];
    expect(first[0]).toBe(client);
    expect(first[1].idempotencyKey).toBe(body().idempotencyKey);
    expect(first[1]).not.toHaveProperty("authorId");
    expect(first[1]).not.toHaveProperty("committedAt");
    expect(vi.mocked(commitLiveClaim).mock.calls[1][1]).toEqual(first[1]);
  });
  it("returns an honest unconfigured state with no sample claims in the live feed", async () => {
    const response = await GET(new Request("http://localhost:3000/api/claims?scope=public"));
    expect(await response.json()).toEqual({ configured: false, claims: [], nextCursor: null });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
