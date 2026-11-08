import { z } from "zod";
import { draftClaimSchema } from "../claims/contracts";

export const parseClaimResultSchema = z.object({
  draft: draftClaimSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
});

export const evidenceItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sourceUrl: z.url(),
  publisher: z.string().min(1),
  publishedAt: z.iso.datetime({ offset: true }),
  retrievedAt: z.iso.datetime({ offset: true }),
  excerpt: z.string().min(1),
  suppliedBy: z.enum(["author", "curator", "provider"]),
});

export const reasoningReviewSchema = z
  .object({
    id: z.string().min(1),
    claimVersionId: z.string().min(1),
    generatedAt: z.iso.datetime({ offset: true }),
    model: z.string().min(1),
    promptVersion: z.string().min(1),
    evidence: z.array(evidenceItemSchema),
    assumptionReviews: z.array(
      z.object({
        assumptionId: z.string().min(1),
        assessment: z.enum(["supported", "contradicted", "unresolved"]),
        explanation: z.string().min(1),
        evidenceIds: z.array(z.string().min(1)),
      }),
    ),
    // No performance outcome field: AI cannot write or change the numeric resolution.
  })
  .superRefine((review, context) => {
    const evidenceIds = new Set(review.evidence.map((item) => item.id));
    review.assumptionReviews.forEach((item, index) => {
      if (item.assessment !== "unresolved" && item.evidenceIds.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["assumptionReviews", index, "evidenceIds"],
          message: "Supported or contradicted assessments require evidence.",
        });
      }
      if (item.evidenceIds.some((id) => !evidenceIds.has(id))) {
        context.addIssue({
          code: "custom",
          path: ["assumptionReviews", index, "evidenceIds"],
          message: "Every citation must reference supplied evidence.",
        });
      }
    });
  });

export type ParseClaimResult = z.infer<typeof parseClaimResultSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type ReasoningReview = z.infer<typeof reasoningReviewSchema>;
