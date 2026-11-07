import { z } from "zod";
import { priceSnapshotSchema } from "../market-data/contracts";

export const measurementWindowSchema = z
  .object({
    startSessionDate: z.iso.date(),
    targetDate: z.iso.date(),
    endSessionDate: z.iso.date(),
  })
  .refine(
    (window) =>
      window.startSessionDate < window.targetDate && window.targetDate <= window.endSessionDate,
    {
      message: "The target must follow the start and the end must be on or after the target.",
    },
  );

export const calculationInputsSchema = z.object({
  assetStart: priceSnapshotSchema,
  assetEnd: priceSnapshotSchema,
  benchmark: z.object({ start: priceSnapshotSchema, end: priceSnapshotSchema }).nullable(),
  // Required by the future resolver for every_daily_observation claims.
  intermediateObservations: z.array(priceSnapshotSchema),
  window: measurementWindowSchema,
});

const commonResolutionFields = {
  id: z.string().min(1),
  claimVersionId: z.string().min(1),
  calculatedAt: z.iso.datetime({ offset: true }),
  formulaVersion: z.string().min(1),
};

export const resolutionSchema = z.discriminatedUnion("outcome", [
  z.object({
    ...commonResolutionFields,
    outcome: z.literal("met"),
    inputs: calculationInputsSchema,
    measurement: z.discriminatedUnion("kind", [
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
    ]),
  }),
  z.object({
    ...commonResolutionFields,
    outcome: z.literal("not_met"),
    inputs: calculationInputsSchema,
    measurement: z.discriminatedUnion("kind", [
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
    ]),
  }),
  z.object({ ...commonResolutionFields, outcome: z.literal("unclear"), reason: z.string().min(1) }),
  z.object({
    ...commonResolutionFields,
    outcome: z.literal("unscored"),
    reason: z.literal("position_statement_without_measurable_condition"),
  }),
]);

export type MeasurementWindow = z.infer<typeof measurementWindowSchema>;
export type CalculationInputs = z.infer<typeof calculationInputsSchema>;
export type Resolution = z.infer<typeof resolutionSchema>;
