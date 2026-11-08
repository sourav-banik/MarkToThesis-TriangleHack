import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/env", () => ({
  getClaudeConfig: vi.fn(() => ({ apiKey: "fixture-secret", model: "claude-haiku-4-5-20251001" })),
}));
import { reviewWithClaude } from "./review";
import { instruments } from "../market-data/catalog";
import type { CommittedClaimVersion } from "../claims/contracts";

const claim: CommittedClaimVersion = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  claimId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  authorId: "11111111-1111-4111-8111-111111111111",
  version: 1,
  originalText: "Apple will outperform SPY over three months.",
  terms: {
    schemaVersion: 1,
    instrument: instruments.aapl,
    prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
    horizon: { kind: "duration", value: 3, unit: "months" },
    confidencePct: 70,
    rationale: "Cloud demand will remain strong.",
    assumptions: [
      { id: "cloud", statement: "Cloud demand remains strong.", falsificationCondition: "Cloud growth slows." },
      { id: "margin", statement: "Margins remain stable.", falsificationCondition: "Margins compress." },
    ],
    returnConvention: { kind: "price_return", dividends: "excluded", splits: "adjusted" },
    measurement: { start: "first_observation_after_commitment", end: "first_observation_on_or_after_target", sampling: "daily", calendarArithmetic: "calendar_units_clamp_month_end", missingData: "await_data_never_substitute" },
  },
  committedAt: "2026-01-01T15:00:00.000Z",
  publishedAt: "2026-01-01T15:00:00.000Z",
  visibility: "public",
  context: { kind: "live" },
  supersedesVersionId: null,
};
const request = {
  evidence: [{ id: "e1", title: "Cloud report", sourceUrl: "https://example.com/cloud", publisher: "Example Research", publishedAt: "2026-01-05T12:00:00.000Z", retrievedAt: "2026-01-06T12:00:00.000Z", excerpt: "Cloud demand increased.", suppliedBy: "author" as const }],
};
const envelope = (output: unknown) => ({ model: "claude-haiku-4-5-20251001", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(output) }] });
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(envelope({ assumptionReviews: [{ assumptionId: "cloud", assessment: "supported", explanation: "The report supports stronger cloud demand.", evidenceIds: ["e1"] }] }))));
});
afterEach(() => vi.unstubAllGlobals());
describe("grounded reasoning review", () => {
  it("fills omitted assumptions as unresolved and preserves supplied evidence", async () => {
    const result = await reviewWithClaude(claim, request, "2026-01-07T12:00:00.000Z");
    expect(result.evidence[0].id).toBe("e1");
    expect(result.assumptionReviews).toHaveLength(2);
    expect(result.assumptionReviews[1].assessment).toBe("unresolved");
  });
  it("rejects model-created evidence references", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(envelope({ assumptionReviews: [{ assumptionId: "cloud", assessment: "supported", explanation: "Unsupported.", evidenceIds: ["invented"] }] }))));
    await expect(reviewWithClaude(claim, request, "2026-01-07T12:00:00.000Z")).rejects.toMatchObject({ status: 502 });
  });
});
