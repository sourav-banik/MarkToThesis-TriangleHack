import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/env", () => ({ getSupabaseConfig: () => null, getClaudeConfig: vi.fn() }));
vi.mock("@/features/auth/server", () => ({ requireAccount: vi.fn() }));
vi.mock("@/features/ai/claude", () => ({ extractWithClaude: vi.fn() }));
vi.mock("@/features/ai/limits", () => ({ acquireParserSlot: vi.fn() }));
import { POST, GET } from "./route";
import { getClaudeConfig } from "@/lib/server/env";
import { requireAccount } from "@/features/auth/server";
import { extractWithClaude } from "@/features/ai/claude";
import { acquireParserSlot } from "@/features/ai/limits";
import { completeCall, comparisonExtraction } from "@/features/ai/test-fixtures";
import { HttpError } from "@/lib/server/http";
const release = vi.fn();
function request(body: unknown = { originalText: completeCall }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/claims/parse", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClaudeConfig).mockReturnValue({
    apiKey: "fixture-secret",
    model: "claude-haiku-4-5-20251001",
  });
  vi.mocked(requireAccount).mockResolvedValue({
    client: {},
    user: { id: "verified-owner" },
    profile: null,
  } as unknown as Awaited<ReturnType<typeof requireAccount>>);
  vi.mocked(acquireParserSlot).mockReturnValue(release);
  vi.mocked(extractWithClaude).mockResolvedValue({
    extraction: comparisonExtraction(),
    model: "fixture-model",
  });
});
describe("claim parser HTTP boundary", () => {
  it("exposes only connection state, never the key", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ configured: true, provider: "anthropic" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects cross-origin parsing before auth or billable work", async () => {
    expect((await POST(request(undefined, "https://foreign.example"))).status).toBe(403);
    expect(requireAccount).not.toHaveBeenCalled();
    expect(extractWithClaude).not.toHaveBeenCalled();
  });
  it("requires a verified account before parsing", async () => {
    vi.mocked(requireAccount).mockRejectedValue(new HttpError(401, "Sign in."));
    expect((await POST(request())).status).toBe(401);
    expect(extractWithClaude).not.toHaveBeenCalled();
  });
  it.each([
    { originalText: "" },
    { originalText: "x".repeat(8001) },
    { originalText: completeCall, ownerId: "someone" },
    { originalText: completeCall, committedAt: "2024-01-01T00:00:00Z" },
    { originalText: completeCall, outcome: "met" },
  ])("rejects invalid or authority-bearing input %o", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(extractWithClaude).not.toHaveBeenCalled();
  });
  it("returns a reviewed proposal, with no persistence capability involved", async () => {
    const response = await POST(request());
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.ready).toBe(true);
    expect(result.draft.originalText).toBe(completeCall);
    expect(result).not.toHaveProperty("committedAt");
    expect(result).not.toHaveProperty("outcome");
    expect(acquireParserSlot).toHaveBeenCalledWith("verified-owner");
    expect(release).toHaveBeenCalledOnce();
  });
  it("releases capacity on provider failure and preserves the safe error", async () => {
    vi.mocked(extractWithClaude).mockRejectedValue(new HttpError(502, "Claude unavailable."));
    expect((await POST(request())).status).toBe(502);
    expect(release).toHaveBeenCalledOnce();
  });
});
