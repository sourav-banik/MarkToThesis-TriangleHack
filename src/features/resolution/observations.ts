import { priceSnapshotSchema, type Instrument, type PriceSnapshot } from "../market-data/contracts";
import type { ObservationSchedule } from "./contracts";

export type ObservationMapResult =
  | { ok: true; observations: Map<string, PriceSnapshot> }
  | { ok: false; reasonCode: string; reason: string };

export function sameInstrument(left: Instrument, right: Instrument) {
  // Both objects have been normalized by the same instrument schema at the boundary.
  return JSON.stringify(left) === JSON.stringify(right);
}

/** No last-price fallback, forward filling, averaging, or implicit provider replacement. */
export function indexObservations(
  schedule: ObservationSchedule,
  records: unknown[],
  asOf: string,
): ObservationMapResult {
  const sessions = new Map(schedule.sessions.map((session) => [session.sessionDate, session]));
  const observations = new Map<string, PriceSnapshot>();
  const snapshotDates = new Map<string, string>();
  const available: PriceSnapshot[] = [];
  for (const record of records) {
    const parsed = priceSnapshotSchema.safeParse(record);
    if (!parsed.success)
      return {
        ok: false,
        reasonCode: "invalid_observation",
        reason:
          "A supplied observation is invalid: " +
          parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
      };
    const snapshot = parsed.data;
    if (
      Date.parse(snapshot.availableAt) > Date.parse(asOf) ||
      Date.parse(snapshot.retrievedAt) > Date.parse(asOf)
    )
      continue;
    if (!sameInstrument(snapshot.instrument, schedule.instrument))
      return {
        ok: false,
        reasonCode: "instrument_mismatch",
        reason: "An observation's full instrument identity differs from its scheduled instrument.",
      };
    if (
      snapshot.source.provider !== schedule.source.provider ||
      snapshot.source.seriesId !== schedule.source.seriesId ||
      snapshot.source.isSynthetic !== schedule.source.isSynthetic
    )
      return {
        ok: false,
        reasonCode: "source_mismatch",
        reason:
          "An observation does not match the calendar's bound provider, series, and data classification.",
      };
    const session = sessions.get(snapshot.sessionDate);
    if (!session || Date.parse(session.observedAt) !== Date.parse(snapshot.observedAt))
      return {
        ok: false,
        reasonCode: "fixing_mismatch",
        reason: "An observation does not match a scheduled session and exact fixing time.",
      };
    available.push(snapshot);
  }
  available.sort(
    (left, right) =>
      Date.parse(left.retrievedAt) - Date.parse(right.retrievedAt) ||
      left.id.localeCompare(right.id) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
  for (const snapshot of available) {
    const existingDate = snapshotDates.get(snapshot.id);
    if (existingDate && existingDate !== snapshot.sessionDate)
      return {
        ok: false,
        reasonCode: "conflicting_observation_ids",
        reason: "One snapshot ID cannot identify observations on different session dates.",
      };
    snapshotDates.set(snapshot.id, snapshot.sessionDate);
    const existing = observations.get(snapshot.sessionDate);
    if (
      existing &&
      (existing.value !== snapshot.value ||
        existing.adjustment !== snapshot.adjustment ||
        existing.adjustmentBasisId !== snapshot.adjustmentBasisId)
    )
      return {
        ok: false,
        reasonCode: "conflicting_observations",
        reason:
          "Conflicting observations exist for one session. A data correction must be resolved explicitly.",
      };
    if (!existing) observations.set(snapshot.sessionDate, snapshot);
  }
  return { ok: true, observations };
}

export function validateAdjustmentBasis(
  observations: PriceSnapshot[],
  quotedValue: boolean,
): string | null {
  const first = observations[0];
  const instrument = first.instrument;
  const expected =
    instrument.quote.kind === "yield"
      ? "not_applicable"
      : !quotedValue && (instrument.assetClass === "stock" || instrument.assetClass === "etf")
        ? "split_adjusted"
        : "unadjusted";
  if (observations.some((snapshot) => snapshot.adjustment !== expected))
    return `This test requires ${expected} observations. Dividend-adjusted data and silently adjusted quote-level targets are not accepted.`;
  if (observations.some((snapshot) => snapshot.adjustmentBasisId !== first.adjustmentBasisId))
    return "Observations use incompatible adjustment bases. Retrieve a consistent series instead of mixing prices across revisions or split bases.";
  return null;
}
