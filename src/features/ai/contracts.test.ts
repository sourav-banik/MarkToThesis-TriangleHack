import { describe, expect, it } from "vitest";
import { reasoningReviewSchema } from "./contracts";

const review = {
  id: "review",
  claimVersionId: "v1",
  generatedAt: "2026-11-07T17:00:00Z",
  model: "test",
  promptVersion: "v1",
  evidence: [
    {
      id: "e1",
      title: "Sample filing",
      sourceUrl: "https://example.com/filing",
      publisher: "Example",
      publishedAt: "2026-10-01T12:00:00Z",
      retrievedAt: "2026-11-07T12:00:00Z",
      excerpt: "Synthetic evidence for a contract test.",
      suppliedBy: "curator",
    },
  ],
  assumptionReviews: [
    {
      assumptionId: "a1",
      assessment: "supported",
      explanation: "The supplied evidence supports this assumption.",
      evidenceIds: ["e1"],
    },
  ],
};

describe("grounded reasoning reviews", () => {
  it("accepts assessments linked to supplied evidence", () => {
    expect(reasoningReviewSchema.safeParse(review).success).toBe(true);
  });
  it("rejects invented citations", () => {
    expect(
      reasoningReviewSchema.safeParse({
        ...review,
        assumptionReviews: [{ ...review.assumptionReviews[0], evidenceIds: ["invented"] }],
      }).success,
    ).toBe(false);
  });
  it("requires evidence for a supported or contradicted assessment", () => {
    expect(
      reasoningReviewSchema.safeParse({
        ...review,
        assumptionReviews: [{ ...review.assumptionReviews[0], evidenceIds: [] }],
      }).success,
    ).toBe(false);
  });
  it("can honestly leave an assumption unresolved without sources", () => {
    expect(
      reasoningReviewSchema.safeParse({
        ...review,
        evidence: [],
        assumptionReviews: [
          { ...review.assumptionReviews[0], assessment: "unresolved", evidenceIds: [] },
        ],
      }).success,
    ).toBe(true);
  });
});
