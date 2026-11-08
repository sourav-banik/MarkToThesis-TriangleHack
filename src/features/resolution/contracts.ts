import { z } from "zod";
import { claimContextSchema, committedClaimVersionSchema } from "../claims/contracts";
import { instrumentSchema, priceSnapshotSchema } from "../market-data/contracts";

export const observationSessionSchema = z
  .object({
    sessionDate: z.iso.date(),
    observedAt: z.iso.datetime({ offset: true }),
    expectedAvailableAt: z.iso.datetime({ offset: true }),
  })
  .refine((session) => Date.parse(session.expectedAvailableAt) >= Date.parse(session.observedAt), {
    message: "Expected publication cannot precede observation.",
  });

/** Supplied by a calendar adapter, never inferred from whichever prices happened to arrive. */
export const observationScheduleSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    instrument: instrumentSchema,
    source: z.object({
      provider: z.string().min(1),
      seriesId: z.string().min(1),
      isSynthetic: z.boolean(),
    }),
    coverage: z.object({ fromDate: z.iso.date(), throughDate: z.iso.date() }),
    completeness: z.literal("complete_for_coverage"),
    sessions: z.array(observationSessionSchema),
  })
  .superRefine((schedule, context) => {
    if (schedule.coverage.fromDate > schedule.coverage.throughDate) {
      context.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "Calendar coverage must be ordered.",
      });
    }
    const dates = new Set<string>();
    for (const [index, session] of schedule.sessions.entries()) {
      if (dates.has(session.sessionDate))
        context.addIssue({
          code: "custom",
          path: ["sessions", index],
          message: "A schedule has one fixing per session date.",
        });
      dates.add(session.sessionDate);
      if (
        session.sessionDate < schedule.coverage.fromDate ||
        session.sessionDate > schedule.coverage.throughDate
      ) {
        context.addIssue({
          code: "custom",
          path: ["sessions", index],
          message: "Sessions must fall within declared coverage.",
        });
      }
    }
    if (schedule.instrument.observation.calendar === "utc_daily") {
      const dayCount =
        (Date.parse(schedule.coverage.throughDate) - Date.parse(schedule.coverage.fromDate)) /
          86_400_000 +
        1;
      if (schedule.sessions.length !== dayCount)
        context.addIssue({
          code: "custom",
          path: ["sessions"],
          message: "A UTC daily calendar must include every date in its declared coverage.",
        });
    }
    const ordered = [...schedule.sessions].sort((a, b) =>
      a.sessionDate.localeCompare(b.sessionDate),
    );
    for (let index = 1; index < ordered.length; index++) {
      if (Date.parse(ordered[index].observedAt) <= Date.parse(ordered[index - 1].observedAt)) {
        context.addIssue({
          code: "custom",
          path: ["sessions"],
          message: "Dated observations must advance in time.",
        });
      }
    }
  });

export const measurementWindowSchema = z
  .object({
    startSessionDate: z.iso.date(),
    targetDate: z.iso.date(),
    endSessionDate: z.iso.date(),
  })
  .refine(
    (window) =>
      window.startSessionDate < window.targetDate && window.targetDate <= window.endSessionDate,
    { message: "The target must follow the start and the end must be on or after the target." },
  );

export const calculationInputsSchema = z.object({
  assetStart: priceSnapshotSchema,
  assetEnd: priceSnapshotSchema,
  benchmark: z.object({ start: priceSnapshotSchema, end: priceSnapshotSchema }).nullable(),
  intermediateObservations: z.array(priceSnapshotSchema),
  window: measurementWindowSchema,
  calendars: z.object({
    asset: observationScheduleSchema,
    benchmark: observationScheduleSchema.nullable(),
  }),
  synchronization: z.literal("common_session_dates_with_explicit_fixings"),
});

export const performanceMeasurementSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("price_return"),
    assetReturnPct: z.number(),
    benchmarkReturnPct: z.number().nullable(),
    excessReturnPp: z.number().nullable(),
  }),
  z.object({
    kind: z.literal("yield_change"),
    assetChangeBps: z.number(),
    benchmarkChangeBps: z.number().nullable(),
    relativeChangeBps: z.number().nullable(),
  }),
  z.object({
    kind: z.literal("quoted_value"),
    startValue: z.number(),
    endValue: z.number(),
    unit: z.string().min(1),
  }),
]);
export const evaluationCheckSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("comparison"),
    metric: z.enum(["excess_return_pp", "relative_yield_change_bps"]),
    value: z.number(),
  }),
  z.object({
    kind: z.literal("band"),
    metric: z.enum(["quoted_value", "price_return_pct", "yield_change_bps"]),
    lower: z.number(),
    upper: z.number(),
    boundaries: z.literal("inclusive"),
    evaluation: z.enum(["at_review", "every_daily_observation"]),
    observations: z.array(
      z.object({
        snapshotId: z.string(),
        sessionDate: z.iso.date(),
        value: z.number(),
        withinBounds: z.boolean(),
      }),
    ),
  }),
]);
const commonResolutionFields = {
  id: z.string().min(1),
  claimVersionId: z.string().min(1),
  calculatedAt: z.iso.datetime({ offset: true }),
  committedAt: z.iso.datetime({ offset: true }),
  context: claimContextSchema,
  formulaVersion: z.string().min(1),
};
const scoredFields = {
  ...commonResolutionFields,
  inputs: calculationInputsSchema,
  measurement: performanceMeasurementSchema,
  check: evaluationCheckSchema,
};
export const resolutionSchema = z.discriminatedUnion("outcome", [
  z.object({ ...scoredFields, outcome: z.literal("met") }),
  z.object({ ...scoredFields, outcome: z.literal("not_met") }),
  z.object({
    ...commonResolutionFields,
    outcome: z.literal("unclear"),
    reasonCode: z.string().min(1),
    reason: z.string().min(1),
  }),
  z.object({
    ...commonResolutionFields,
    outcome: z.literal("unscored"),
    reason: z.literal("position_statement_without_measurable_condition"),
  }),
]);
const seriesInputSchema = z.object({
  schedule: observationScheduleSchema,
  // Invalid market data is handled separately from malformed claim requests.
  observations: z.array(z.unknown()),
});
export const resolutionContextSchema = z
  .object({
    resolutionId: z.string().min(1),
    claim: committedClaimVersionSchema,
    asOf: z.iso.datetime({ offset: true }),
  })
  .superRefine((request, context) => {
    if (Date.parse(request.asOf) < Date.parse(request.claim.committedAt))
      context.addIssue({
        code: "custom",
        path: ["asOf"],
        message: "Calculation cannot precede actual logging, including in a replay.",
      });
  });
export const resolutionRequestSchema = resolutionContextSchema.safeExtend({
  asset: seriesInputSchema,
  benchmark: seriesInputSchema.nullable().default(null),
});
export type ObservationSession = z.infer<typeof observationSessionSchema>;
export type ObservationSchedule = z.infer<typeof observationScheduleSchema>;
export type MeasurementWindow = z.infer<typeof measurementWindowSchema>;
export type CalculationInputs = z.infer<typeof calculationInputsSchema>;
export type PerformanceMeasurement = z.infer<typeof performanceMeasurementSchema>;
export type EvaluationCheck = z.infer<typeof evaluationCheckSchema>;
export type Resolution = z.infer<typeof resolutionSchema>;
export type ResolutionRequest = z.infer<typeof resolutionRequestSchema>;
export type PlannedWindow = {
  startSessionDate: string;
  targetDate: string;
  endSessionDate: string | null;
};
export type ResolutionAttempt =
  | { status: "invalid_input"; issues: { path: string; message: string }[] }
  | {
      status: "awaiting_start" | "active" | "awaiting_data";
      reasonCode: string;
      reason: string;
      window: PlannedWindow | null;
      missingObservations: {
        instrumentId: string;
        sessionDate: string;
        expectedAvailableAt: string;
      }[];
    }
  | { status: "met" | "not_met" | "unclear" | "unscored"; resolution: Resolution };
