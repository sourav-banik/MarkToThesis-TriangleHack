import { z } from "zod";
import { commitmentTermsSchema, committedClaimVersionSchema } from "./contracts";
import { resolutionSchema } from "../resolution/contracts";
import { reasoningReviewSchema } from "../ai/contracts";
import { liveBindingFor } from "../market-data/live-bindings";
import { instrumentCatalog } from "../market-data/catalog";

export const liveClaimRequestSchema = z
  .strictObject({
    idempotencyKey: z.uuid(),
    originalText: z.string().trim().min(1, "Write the original call.").max(8000),
    terms: commitmentTermsSchema,
    visibility: z.enum(["public", "private"]),
    supersedesClaimId: z.uuid().nullable().default(null),
  })
  .superRefine((request, context) => {
    const { terms } = request;
    if (
      terms.rationale.length > 8000 ||
      terms.assumptions.length > 20 ||
      terms.assumptions.some(
        (assumption) =>
          assumption.id.length > 100 ||
          assumption.statement.length > 2000 ||
          assumption.falsificationCondition.length > 2000,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["terms", "rationale"],
        message: "Keep rationale under 8,000 characters and use up to 20 concise assumptions.",
      });
    }
    if (
      new Set(terms.assumptions.map((assumption) => assumption.id)).size !==
      terms.assumptions.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["terms", "assumptions"],
        message: "Assumption IDs must be unique.",
      });
    }
    const instruments = [
      terms.instrument,
      ...(terms.prediction.kind === "outperform" || terms.prediction.kind === "underperform"
        ? [terms.prediction.benchmark]
        : []),
    ];
    const positionOnly =
      terms.prediction.kind === "hold" && terms.prediction.meaning.kind === "maintain_position";
    for (const instrument of instruments) {
      const canonical = instrumentCatalog.find((item) => item.id === instrument.id);
      if (
        !(positionOnly && canonical && JSON.stringify(canonical) === JSON.stringify(instrument)) &&
        !liveBindingFor(instrument)
      )
        context.addIssue({
          code: "custom",
          path: ["terms", "instrument"],
          message: `${instrument.symbol} needs a fixed live data source before it can be logged. It remains available in synthetic replay.`,
        });
    }
  });

export const persistedClaimSchema = z.object({
  version: committedClaimVersionSchema.refine(
    (version) => version.context.kind === "live",
    "Persistent claims must use live context.",
  ),
  status: z.enum(["awaiting_start", "active", "awaiting_data", "met", "not_met", "unclear", "unscored"]),
  supersedesClaimId: z.uuid().nullable(),
  marketBindings: z.record(z.string(), z.unknown()),
  resolution: resolutionSchema.nullable().optional(),
  reasoningReview: reasoningReviewSchema.nullable().optional(),
});
export type LiveClaimRequest = z.infer<typeof liveClaimRequestSchema>;
export type PersistedClaim = z.infer<typeof persistedClaimSchema>;
