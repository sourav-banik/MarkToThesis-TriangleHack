import { z } from "zod";
import { instrumentSchema } from "../market-data/contracts";
import { calendarDateAt } from "../../lib/dates";

export const horizonSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("duration"),
    value: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    unit: z.enum(["days", "months", "years"]),
  }),
  z.object({ kind: z.literal("date"), targetDate: z.iso.date() }),
]);

export const returnConventionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("price_return"),
    dividends: z.literal("excluded"),
    splits: z.literal("adjusted"),
  }),
  // Reserved extension point. Commitment validation rejects it until supported.
  z.object({
    kind: z.literal("total_return"),
    dividends: z.literal("reinvested"),
    splits: z.literal("adjusted"),
    methodologyId: z.string().min(1),
  }),
]);

const comparisonFields = {
  benchmark: instrumentSchema,
  metric: z.enum(["price_return", "yield_change_bps"]),
};

export const predictionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("outperform"), ...comparisonFields }),
  z.object({ kind: z.literal("underperform"), ...comparisonFields }),
  z.object({
    kind: z.literal("hold"),
    meaning: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("neutral"),
        tolerance: z.number().positive(),
        metric: z.enum(["price_return_pct", "yield_change_bps"]),
        evaluation: z.enum(["at_review", "every_daily_observation"]),
      }),
      z.object({ kind: z.literal("maintain_position") }),
    ]),
  }),
  z
    .object({
      kind: z.literal("range"),
      lower: z.number(),
      upper: z.number(),
      metric: z.enum(["quoted_value", "price_return_pct", "yield_change_bps"]),
      boundaries: z.literal("inclusive"),
      evaluation: z.enum(["at_review", "every_daily_observation"]),
    })
    .refine((value) => value.lower < value.upper, {
      path: ["upper"],
      message: "The upper bound must exceed the lower bound.",
    }),
]);

export const assumptionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  falsificationCondition: z.string().min(1),
});

export const confirmedTermsSchema = z
  .object({
    schemaVersion: z.literal(1),
    instrument: instrumentSchema,
    prediction: predictionSchema,
    horizon: horizonSchema,
    confidencePct: z.number().min(0).max(100).nullable(),
    rationale: z.string(),
    assumptions: z.array(assumptionSchema),
    returnConvention: returnConventionSchema,
    measurement: z.object({
      start: z.literal("first_observation_after_commitment"),
      end: z.literal("first_observation_on_or_after_target"),
      sampling: z.literal("daily"),
      calendarArithmetic: z.literal("calendar_units_clamp_month_end"),
      missingData: z.literal("await_data_never_substitute"),
    }),
  })
  .superRefine((terms, context) => {
    const { instrument, prediction } = terms;
    const isYield = instrument.quote.kind === "yield";
    const expectedChangeMetric = isYield ? "yield_change_bps" : "price_return_pct";
    if (prediction.kind === "outperform" || prediction.kind === "underperform") {
      if (instrument.id === prediction.benchmark.id) {
        context.addIssue({
          code: "custom",
          path: ["prediction", "benchmark"],
          message: "Choose a different benchmark.",
        });
      }
      const benchmarkQuote = prediction.benchmark.quote;
      if (instrument.quote.kind !== benchmarkQuote.kind) {
        context.addIssue({
          code: "custom",
          path: ["prediction", "benchmark"],
          message: "Price returns and yield changes cannot be compared.",
        });
      }
      if (
        instrument.quote.kind === "price" &&
        benchmarkQuote.kind === "price" &&
        instrument.quote.currency !== benchmarkQuote.currency
      ) {
        context.addIssue({
          code: "custom",
          path: ["prediction", "benchmark"],
          message: "Cross-currency comparisons require a future explicit FX convention.",
        });
      }
      if (prediction.metric !== (isYield ? "yield_change_bps" : "price_return")) {
        context.addIssue({
          code: "custom",
          path: ["prediction", "metric"],
          message: "The comparison metric must match the observation type.",
        });
      }
    }
    if (
      prediction.kind === "hold" &&
      prediction.meaning.kind === "neutral" &&
      prediction.meaning.metric !== expectedChangeMetric
    ) {
      context.addIssue({
        code: "custom",
        path: ["prediction", "meaning", "metric"],
        message: "Hold tolerance units must match the instrument.",
      });
    }
    if (prediction.kind === "range") {
      if (prediction.metric !== "quoted_value" && prediction.metric !== expectedChangeMetric) {
        context.addIssue({
          code: "custom",
          path: ["prediction", "metric"],
          message: "Range units must match the instrument.",
        });
      }
      if (
        prediction.metric === "quoted_value" &&
        instrument.quote.kind === "price" &&
        !instrument.quote.allowNonPositive &&
        prediction.lower <= 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["prediction", "lower"],
          message: "This quoted price range must be positive.",
        });
      }
      if (
        prediction.metric === "price_return_pct" &&
        prediction.lower < -100 &&
        instrument.quote.kind === "price" &&
        !instrument.quote.allowNonPositive
      ) {
        context.addIssue({
          code: "custom",
          path: ["prediction", "lower"],
          message: "A positive price series cannot return less than -100%.",
        });
      }
    }
  });

export const commitmentTermsSchema = confirmedTermsSchema.superRefine((terms, context) => {
  if (terms.returnConvention.kind === "total_return") {
    context.addIssue({
      code: "custom",
      path: ["returnConvention"],
      message: "Dividend-inclusive performance is reserved for a later implementation.",
    });
  }
});

export const claimStatusSchema = z.enum([
  "awaiting_start",
  "active",
  "awaiting_data",
  "met",
  "not_met",
  "unclear",
  "unscored",
]);

export const claimContextSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("live") }),
  z.object({
    kind: z.literal("replay"),
    simulatedCommitmentAt: z.iso.datetime({ offset: true }),
    datasetId: z.string().min(1),
  }),
]);

export const committedClaimVersionSchema = z
  .object({
    id: z.string().min(1),
    claimId: z.string().min(1),
    authorId: z.string().min(1),
    version: z.number().int().positive(),
    originalText: z.string().trim().min(1),
    terms: commitmentTermsSchema,
    committedAt: z.iso.datetime({ offset: true }),
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
    visibility: z.enum(["public", "private"]),
    context: claimContextSchema,
    supersedesVersionId: z.string().nullable(),
  })
  .superRefine((version, context) => {
    const referenceAt =
      version.context.kind === "replay"
        ? version.context.simulatedCommitmentAt
        : version.committedAt;
    const commitmentDate = calendarDateAt(
      referenceAt,
      version.terms.instrument.observation.timeZone,
    );
    if (
      version.terms.horizon.kind === "date" &&
      commitmentDate !== null &&
      version.terms.horizon.targetDate <= commitmentDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["terms", "horizon"],
        message: "The target date must be after the commitment date.",
      });
    }
    if (version.publishedAt && Date.parse(version.publishedAt) < Date.parse(version.committedAt)) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Publication cannot precede logging.",
      });
    }
    if (
      version.context.kind === "replay" &&
      Date.parse(version.context.simulatedCommitmentAt) >= Date.parse(version.committedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["context"],
        message: "A historical replay must precede the actual logging timestamp.",
      });
    }
  });

export const missingFieldSchema = z.enum([
  "instrument",
  "prediction",
  "benchmark",
  "horizon",
  "hold_meaning",
  "tolerance",
  "range_bounds",
  "evaluation",
  "rationale",
]);

// Partial proposals are deliberately separate from publishable, confirmed terms.
export const draftClaimSchema = z.object({
  id: z.string().min(1),
  originalText: z.string(),
  proposedTerms: z.object({
    instrument: instrumentSchema.optional(),
    prediction: predictionSchema.optional(),
    horizon: horizonSchema.optional(),
    confidencePct: z.number().min(0).max(100).nullable().optional(),
    rationale: z.string().optional(),
    assumptions: z.array(assumptionSchema).optional(),
  }),
  missingFields: z.array(missingFieldSchema),
  clarificationQuestions: z.array(
    z.object({
      field: missingFieldSchema,
      question: z.string().min(1),
    }),
  ),
});

export type Horizon = z.infer<typeof horizonSchema>;
export type Prediction = z.infer<typeof predictionSchema>;
export type ConfirmedTerms = z.infer<typeof confirmedTermsSchema>;
export type DraftClaim = z.infer<typeof draftClaimSchema>;
export type CommittedClaimVersion = z.infer<typeof committedClaimVersionSchema>;
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export function isScorablePrediction(prediction: Prediction) {
  return !(prediction.kind === "hold" && prediction.meaning.kind === "maintain_position");
}
