/** Fabricated numbers and schedules for engine verification and the next UI increment.
 * These are neither real historical prices nor a historical claim record.
 */
import { committedClaimVersionSchema, type ConfirmedTerms } from "../features/claims/contracts";
import { instruments } from "../features/market-data/catalog";
import { priceSnapshotSchema, type Instrument } from "../features/market-data/contracts";
import {
  observationScheduleSchema,
  resolutionRequestSchema,
  type ResolutionRequest,
} from "../features/resolution/contracts";
import { defaultTerms } from "./claims";

export const syntheticSessionDates = [
  "2024-01-02",
  "2024-01-03",
  "2024-01-04",
  "2024-01-05",
  "2024-01-08",
  "2024-01-09",
  "2024-01-10",
];
const utcDates = [
  "2024-01-02",
  "2024-01-03",
  "2024-01-04",
  "2024-01-05",
  "2024-01-06",
  "2024-01-07",
  "2024-01-08",
  "2024-01-09",
  "2024-01-10",
];

export function syntheticSeries(
  instrument: Instrument,
  values: number[] = [],
  sessionDates = instrument.observation.calendar === "utc_daily" ? utcDates : syntheticSessionDates,
) {
  const source = {
    provider: "synthetic-fixture",
    seriesId: `synthetic:${instrument.id}`,
    isSynthetic: true,
  };
  const schedule = observationScheduleSchema.parse({
    id: `synthetic-calendar:${instrument.id}`,
    version: "fixture-v1",
    instrument,
    source,
    coverage: { fromDate: "2024-01-02", throughDate: "2024-01-10" },
    completeness: "complete_for_coverage",
    sessions: sessionDates.map((sessionDate) => ({
      sessionDate,
      observedAt: `${sessionDate}T21:00:00Z`,
      expectedAvailableAt: `${sessionDate}T21:05:00Z`,
    })),
  });
  const observations = schedule.sessions.map((session, index) =>
    priceSnapshotSchema.parse({
      id: `${source.seriesId}:${session.sessionDate}`,
      instrument,
      value: values[index] ?? 100,
      sessionDate: session.sessionDate,
      observedAt: session.observedAt,
      availableAt: session.expectedAvailableAt,
      retrievedAt: `${session.sessionDate}T21:10:00Z`,
      source: { ...source, sourceUrl: "https://example.com/marktothesis/synthetic-fixture" },
      adjustment:
        instrument.quote.kind === "yield"
          ? "not_applicable"
          : instrument.assetClass === "stock" || instrument.assetClass === "etf"
            ? "split_adjusted"
            : "unadjusted",
      adjustmentBasisId: `synthetic-basis:${instrument.id}:v1`,
    }),
  );
  return { schedule, observations };
}

export function syntheticResolutionRequest(): ResolutionRequest {
  const terms: ConfirmedTerms = {
    ...defaultTerms,
    assumptions: [],
    instrument: instruments.aapl,
    prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
    horizon: { kind: "duration", value: 1, unit: "days" },
  };
  return resolutionRequestSchema.parse({
    resolutionId: "synthetic-resolution-v1",
    claim: committedClaimVersionSchema.parse({
      id: "synthetic-claim-version-v1",
      claimId: "synthetic-claim",
      authorId: "synthetic-author",
      version: 1,
      originalText: "Synthetic example: AAPL will outperform SPY over one calendar day.",
      terms,
      committedAt: "2026-11-07T14:00:00Z",
      publishedAt: "2026-11-07T14:00:00Z",
      visibility: "public",
      context: {
        kind: "replay",
        simulatedCommitmentAt: "2024-01-02T20:00:00Z",
        datasetId: "synthetic-only-v1",
      },
      supersedesVersionId: null,
    }),
    asOf: "2026-11-07T15:00:00Z",
    asset: syntheticSeries(instruments.aapl, [100, 110]),
    benchmark: syntheticSeries(instruments.spy, [100, 105]),
  });
}
