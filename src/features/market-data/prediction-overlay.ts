import { calendarDateAt } from "@/lib/dates";
import type { ConfirmedTerms } from "@/features/claims/contracts";
import { targetDateForHorizon } from "@/features/resolution/calendar";
import { buildNyseSchedule } from "./nyse-calendar";
import type { ClaimChart } from "./chart-contracts";

function shift(date: string, days: number) {
  const timestamp = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return Number.isFinite(timestamp) && timestamp <= Date.parse("9999-12-31T00:00:00Z")
    ? new Date(timestamp).toISOString().slice(0, 10)
    : date;
}
function firstSession(terms: ConfirmedTerms, date: string, after?: string) {
  if (date < "2024-01-01" || shift(date, 14) > "2028-12-31") return null;
  const schedule = buildNyseSchedule(terms.instrument, date, shift(date, 14), []);
  return (
    schedule.sessions.find(
      (session) => !after || Date.parse(session.observedAt) > Date.parse(after),
    )?.sessionDate ?? null
  );
}

export function predictionOverlay(chart: ClaimChart, terms = chart.terms) {
  const draft = chart.committedAt === null;
  const loggingDate = calendarDateAt(
    chart.committedAt ?? chart.asOf,
    terms.instrument.observation.timeZone,
  )!;
  const startDate = firstSession(terms, loggingDate, chart.committedAt ?? chart.asOf);
  const target = startDate ? targetDateForHorizon(startDate, terms.horizon) : null;
  const targetDate = target?.ok
    ? target.date
    : terms.horizon.kind === "date"
      ? terms.horizon.targetDate
      : null;
  const reviewDate = targetDate ? firstSession(terms, targetDate) : null;
  const referenceDate = draft ? (chart.asset.points.at(-1)?.date ?? null) : startDate;
  const assetReference =
    chart.asset.points.find((point) => point.date === referenceDate)?.value ?? null;
  // Both comparison lines share the same base date; missing data is never substituted.
  const benchmarkReference =
    chart.benchmark?.points.find((point) => point.date === referenceDate)?.value ?? null;
  const prediction = terms.prediction;
  let band: { lower: number; upper: number; unit: "price" | "return"; daily: boolean } | null =
    null;
  if (prediction.kind === "range" && prediction.metric !== "yield_change_bps")
    band = {
      lower: prediction.lower,
      upper: prediction.upper,
      unit: prediction.metric === "quoted_value" ? "price" : "return",
      daily: prediction.evaluation === "every_daily_observation",
    };
  if (
    prediction.kind === "hold" &&
    prediction.meaning.kind === "neutral" &&
    prediction.meaning.metric === "price_return_pct"
  )
    band = {
      lower: -prediction.meaning.tolerance,
      upper: prediction.meaning.tolerance,
      unit: "return",
      daily: prediction.meaning.evaluation === "every_daily_observation",
    };
  const requestedEnd = reviewDate ?? targetDate ?? shift(chart.throughDate, 30);
  const cappedEnd = [requestedEnd, shift(chart.throughDate, 365)].sort()[0];
  return {
    draft,
    loggingDate,
    startDate,
    targetDate,
    reviewDate,
    referenceDate,
    assetReference,
    benchmarkReference,
    band,
    mode:
      band?.unit === "price" ||
      (prediction.kind === "hold" && prediction.meaning.kind === "maintain_position")
        ? ("price" as const)
        : ("return" as const),
    // Very long horizons keep a readable window; the actual target date remains visible in text.
    viewEnd: cappedEnd < chart.throughDate ? chart.throughDate : cappedEnd,
  };
}
