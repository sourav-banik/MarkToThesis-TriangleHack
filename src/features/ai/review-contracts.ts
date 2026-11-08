import { z } from "zod";
import { evidenceItemSchema, reasoningReviewSchema } from "./contracts";

export const reviewEvidenceSchema = evidenceItemSchema.extend({
  title: z.string().trim().min(1).max(240),
  publisher: z.string().trim().min(1).max(160),
  excerpt: z.string().trim().min(1).max(4000),
});

export const reasoningReviewRequestSchema = z.strictObject({
  evidence: z.array(reviewEvidenceSchema).min(1).max(12),
}).superRefine((request, context) => {
  if (new Set(request.evidence.map((item) => item.id)).size !== request.evidence.length)
    context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence IDs must be unique." });
});

export const reviewOutputSchema = z.strictObject({
  assumptionReviews: z.array(
    z.strictObject({
      assumptionId: z.string().min(1).max(100),
      assessment: z.enum(["supported", "contradicted", "unresolved"]),
      explanation: z.string().trim().min(1).max(2000),
      evidenceIds: z.array(z.string().min(1).max(100)).max(12),
    }),
  ).max(20),
});

export type ReasoningReviewRequest = z.infer<typeof reasoningReviewRequestSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type ReasoningReview = z.infer<typeof reasoningReviewSchema>;
