import { isScorablePrediction } from "../claims/contracts";
import { calendarDateAt } from "../../lib/dates";
import { selectMeasurementWindow } from "./calendar";
import { indexObservations, sameInstrument, validateAdjustmentBasis } from "./observations";
import { evaluatePrediction } from "./evaluate";
import {
  resolutionRequestSchema,
  resolutionContextSchema,
  resolutionSchema,
  type ObservationSchedule,
  type ObservationSession,
  type PlannedWindow,
  type ResolutionAttempt,
} from "./contracts";

export const FORMULA_VERSION = "daily-claims-v1";

/** Pure entry point: explicit clock and ID, no fetching, AI, persistence, or mutation. */
export function resolveClaim(input: unknown): ResolutionAttempt {
  const parsed = resolutionContextSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid_input",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  const request = parsed.data;
  const { claim, asOf } = request;
  const base = {
    id: request.resolutionId,
    claimVersionId: claim.id,
    calculatedAt: asOf,
    committedAt: claim.committedAt,
    context: claim.context,
    formulaVersion: FORMULA_VERSION,
  };
  const unclear = (reasonCode: string, reason: string): ResolutionAttempt => ({
    status: "unclear",
    resolution: { ...base, outcome: "unclear", reasonCode, reason },
  });
  const pending = (
    status: "awaiting_start" | "active" | "awaiting_data",
    reasonCode: string,
    reason: string,
    window: PlannedWindow | null = null,
    missingObservations: {
      instrumentId: string;
      sessionDate: string;
      expectedAvailableAt: string;
    }[] = [],
  ): ResolutionAttempt => ({ status, reasonCode, reason, window, missingObservations });
  if (!isScorablePrediction(claim.terms.prediction))
    return {
      status: "unscored",
      resolution: {
        ...base,
        outcome: "unscored",
        reason: "position_statement_without_measurable_condition",
      },
    };
  const marketInput = resolutionRequestSchema.safeParse(input);
  if (!marketInput.success)
    return {
      status: "invalid_input",
      issues: marketInput.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  const { asset, benchmark } = marketInput.data;
  const prediction = claim.terms.prediction;
  const comparison = prediction.kind === "outperform" || prediction.kind === "underperform";
  if (!sameInstrument(claim.terms.instrument, asset.schedule.instrument))
    return unclear(
      "instrument_mismatch",
      "The asset calendar does not describe the committed instrument.",
    );
  if (
    comparison &&
    (!benchmark || !sameInstrument(prediction.benchmark, benchmark.schedule.instrument))
  )
    return unclear(
      "benchmark_mismatch",
      "A comparison needs the exact benchmark calendar saved in its terms.",
    );
  if (!comparison && benchmark)
    return unclear(
      "unexpected_benchmark",
      "A non-comparison claim must not introduce an unstated benchmark.",
    );

  const selection = selectMeasurementWindow(
    claim,
    asset.schedule,
    benchmark?.schedule ?? null,
    asOf,
  );
  if (selection.kind === "unclear") return unclear(selection.reasonCode, selection.reason);
  if (selection.kind === "pending")
    return pending(selection.status, selection.reasonCode, selection.reason);
  const { window } = selection;
  if (
    [selection.assetStart, selection.benchmarkStart].some(
      (session) => session && Date.parse(session.observedAt) > Date.parse(asOf),
    )
  )
    return pending(
      "awaiting_start",
      "starting_fixing_pending",
      "The selected starting fixing has not occurred.",
      window,
    );

  const assetIndex = indexObservations(asset.schedule, asset.observations, asOf);
  if (!assetIndex.ok) return unclear(assetIndex.reasonCode, assetIndex.reason);
  const benchmarkIndex = benchmark
    ? indexObservations(benchmark.schedule, benchmark.observations, asOf)
    : null;
  if (benchmarkIndex && !benchmarkIndex.ok)
    return unclear(benchmarkIndex.reasonCode, benchmarkIndex.reason);
  const benchmarkMap = benchmarkIndex?.ok ? benchmarkIndex.observations : null;
  const missing: { instrumentId: string; sessionDate: string; expectedAvailableAt: string }[] = [];
  function requireObservation(schedule: ObservationSchedule, session: ObservationSession) {
    const map =
      schedule === asset.schedule ? (assetIndex.ok ? assetIndex.observations : null) : benchmarkMap;
    const snapshot = map?.get(session.sessionDate);
    if (!snapshot)
      missing.push({
        instrumentId: schedule.instrument.id,
        sessionDate: session.sessionDate,
        expectedAvailableAt: session.expectedAvailableAt,
      });
    return snapshot;
  }
  const assetStart = requireObservation(asset.schedule, selection.assetStart);
  const benchmarkStart =
    benchmark && selection.benchmarkStart
      ? requireObservation(benchmark.schedule, selection.benchmarkStart)
      : null;
  if (!assetStart || (comparison && !benchmarkStart))
    return pending(
      "awaiting_data",
      "starting_observations_missing",
      "The fixed starting session is missing data or its publication is not yet available. A later price will not replace it.",
      window,
      missing,
    );

  if (!selection.assetEnd) {
    const targetInFuture =
      window.targetDate > calendarDateAt(asOf, claim.terms.instrument.observation.timeZone)!;
    return pending(
      targetInFuture ? "active" : "awaiting_data",
      targetInFuture ? "horizon_not_elapsed" : "calendar_coverage_missing",
      targetInFuture
        ? "The review horizon has not elapsed."
        : "The calendar must cover the first eligible shared fixing on or after the target date.",
      window,
    );
  }
  if (
    [selection.assetEnd, selection.benchmarkEnd].some(
      (session) => session && Date.parse(session.observedAt) > Date.parse(asOf),
    )
  )
    return pending(
      "active",
      "review_fixing_pending",
      "The selected ending fixing has not occurred, even if the target falls on a market holiday.",
      window,
    );
  const assetEnd = requireObservation(asset.schedule, selection.assetEnd);
  const benchmarkEnd =
    benchmark && selection.benchmarkEnd
      ? requireObservation(benchmark.schedule, selection.benchmarkEnd)
      : null;
  const everyDaily =
    prediction.kind === "range"
      ? prediction.evaluation === "every_daily_observation"
      : prediction.kind === "hold" &&
        prediction.meaning.kind === "neutral" &&
        prediction.meaning.evaluation === "every_daily_observation";
  const intermediate = everyDaily
    ? asset.schedule.sessions
        .filter(
          (session) =>
            session.sessionDate > window.startSessionDate &&
            session.sessionDate < window.endSessionDate!,
        )
        .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate))
        .map((session) => requireObservation(asset.schedule, session))
    : [];
  if (!assetEnd || (comparison && !benchmarkEnd) || intermediate.some((snapshot) => !snapshot))
    return pending(
      "awaiting_data",
      "required_observations_missing",
      "The review window is fixed, but required endpoint or daily observations are missing or not yet available.",
      window,
      missing,
    );
  const daily = intermediate.filter((snapshot) => snapshot !== undefined);
  const quotedValue = prediction.kind === "range" && prediction.metric === "quoted_value";
  const adjustmentProblem =
    validateAdjustmentBasis([assetStart, ...daily, assetEnd], quotedValue) ??
    (benchmarkStart && benchmarkEnd
      ? validateAdjustmentBasis([benchmarkStart, benchmarkEnd], false)
      : null);
  if (adjustmentProblem) return unclear("incompatible_adjustments", adjustmentProblem);
  const benchmarkInputs =
    benchmarkStart && benchmarkEnd ? { start: benchmarkStart, end: benchmarkEnd } : null;
  try {
    const evaluation = evaluatePrediction(
      claim.terms,
      assetStart,
      assetEnd,
      benchmarkInputs,
      daily,
    );
    const outcome = evaluation.met ? "met" : "not_met";
    const resolution = resolutionSchema.parse({
      ...base,
      outcome,
      inputs: {
        assetStart,
        assetEnd,
        benchmark: benchmarkInputs,
        intermediateObservations: daily,
        window,
        calendars: { asset: asset.schedule, benchmark: benchmark?.schedule ?? null },
        synchronization: "common_session_dates_with_explicit_fixings",
      },
      measurement: evaluation.measurement,
      check: evaluation.check,
    });
    return { status: outcome, resolution };
  } catch (error) {
    return unclear(
      "unsupported_calculation",
      error instanceof Error
        ? error.message
        : "The supplied inputs cannot produce a finite, valid calculation.",
    );
  }
}
