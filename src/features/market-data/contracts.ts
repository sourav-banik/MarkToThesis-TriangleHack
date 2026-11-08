import { z } from "zod";

export const assetClassSchema = z.enum([
  "stock",
  "etf",
  "index",
  "crypto",
  "commodity",
  "fx",
  "sovereign_yield",
]);

export const priceQuoteSchema = z.object({
  kind: z.literal("price"),
  currency: z.string().regex(/^[A-Z]{3}$/),
  unit: z.string().min(1),
  allowNonPositive: z.boolean().default(false),
});

export const yieldQuoteSchema = z.object({
  kind: z.literal("yield"),
  unit: z.literal("percent"),
  tenorYears: z.number().positive(),
});

export const instrumentSchema = z
  .object({
    id: z.string().min(1),
    symbol: z.string().min(1),
    name: z.string().min(1),
    assetClass: assetClassSchema,
    // Distinguishes the exact stock listing, spot series, futures contract, or yield series.
    definition: z.string().min(1),
    venue: z.string().min(1),
    quote: z.discriminatedUnion("kind", [priceQuoteSchema, yieldQuoteSchema]),
    observation: z.object({
      calendar: z.enum(["exchange_sessions", "utc_daily", "publisher_daily"]),
      timeZone: z.string().refine((value) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Use a valid IANA time zone."),
      fixing: z.string().min(1),
    }),
  })
  .superRefine((instrument, context) => {
    if ((instrument.assetClass === "sovereign_yield") !== (instrument.quote.kind === "yield")) {
      context.addIssue({
        code: "custom",
        path: ["quote"],
        message: "Yield series need a yield quote; traded assets need a price quote.",
      });
    }
  });

export type Instrument = z.infer<typeof instrumentSchema>;
export type AssetClass = z.infer<typeof assetClassSchema>;

export const priceSnapshotSchema = z
  .object({
    id: z.string().min(1),
    instrument: instrumentSchema,
    value: z.number(),
    sessionDate: z.iso.date(),
    observedAt: z.iso.datetime({ offset: true }),
    availableAt: z.iso.datetime({ offset: true }),
    retrievedAt: z.iso.datetime({ offset: true }),
    source: z.object({
      provider: z.string().min(1),
      seriesId: z.string().min(1),
      sourceUrl: z.url(),
      isSynthetic: z.boolean(),
    }),
    adjustment: z.enum(["unadjusted", "split_adjusted", "total_return", "not_applicable"]),
    // Snapshots used together must share an adjustment basis, not merely an adjustment label.
    adjustmentBasisId: z.string().min(1),
  })
  .superRefine((snapshot, context) => {
    const quote = snapshot.instrument.quote;
    if (quote.kind === "price" && !quote.allowNonPositive && snapshot.value <= 0) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "This price series requires a positive value.",
      });
    }
    if (quote.kind === "yield" && snapshot.adjustment !== "not_applicable") {
      context.addIssue({
        code: "custom",
        path: ["adjustment"],
        message: "Yield observations do not use price adjustments.",
      });
    }
    if (
      Date.parse(snapshot.availableAt) < Date.parse(snapshot.observedAt) ||
      Date.parse(snapshot.retrievedAt) < Date.parse(snapshot.availableAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["retrievedAt"],
        message: "Observation, publication, and retrieval timestamps must be ordered.",
      });
    }
  });

// The adapter will be implemented in the market-data increment, not in UI components.
export type PriceSnapshot = z.infer<typeof priceSnapshotSchema>;
export type ObservationRequest = {
  instrument: Instrument;
  fromDate: string;
  throughDate: string;
  adjustment: PriceSnapshot["adjustment"];
};
export interface MarketDataAdapter {
  getObservations(request: ObservationRequest): Promise<PriceSnapshot[]>;
}
