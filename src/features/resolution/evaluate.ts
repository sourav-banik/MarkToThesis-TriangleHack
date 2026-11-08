import type { ConfirmedTerms } from "../claims/contracts";
import type { PriceSnapshot } from "../market-data/contracts";
import type { EvaluationCheck, PerformanceMeasurement } from "./contracts";
import { change, compare, decimal, finiteNumber, subtract } from "./arithmetic";

export type Evaluation = {
  met: boolean;
  measurement: PerformanceMeasurement;
  check: EvaluationCheck;
};

export function evaluatePrediction(
  terms: ConfirmedTerms,
  assetStart: PriceSnapshot,
  assetEnd: PriceSnapshot,
  benchmark: { start: PriceSnapshot; end: PriceSnapshot } | null,
  daily: PriceSnapshot[],
): Evaluation {
  const prediction = terms.prediction;
  if (prediction.kind === "hold" && prediction.meaning.kind === "maintain_position")
    throw new Error("A position statement has no market-performance score.");
  if (prediction.kind === "outperform" || prediction.kind === "underperform") {
    if (!benchmark) throw new Error("A comparison requires benchmark observations.");
    const isYield = prediction.metric === "yield_change_bps";
    const metric = isYield ? "yield_change_bps" : "price_return_pct";
    const assetChange = change(assetStart.value, assetEnd.value, metric);
    const benchmarkChange = change(benchmark.start.value, benchmark.end.value, metric);
    const relative = subtract(assetChange, benchmarkChange);
    const direction = compare(relative, decimal(0));
    const met = prediction.kind === "outperform" ? direction > 0 : direction < 0;
    return {
      met,
      measurement: isYield
        ? {
            kind: "yield_change",
            assetChangeBps: finiteNumber(assetChange),
            benchmarkChangeBps: finiteNumber(benchmarkChange),
            relativeChangeBps: finiteNumber(relative),
          }
        : {
            kind: "price_return",
            assetReturnPct: finiteNumber(assetChange),
            benchmarkReturnPct: finiteNumber(benchmarkChange),
            excessReturnPp: finiteNumber(relative),
          },
      check: {
        kind: "comparison",
        metric: isYield ? "relative_yield_change_bps" : "excess_return_pp",
        value: finiteNumber(relative),
      },
    };
  }
  let band: {
    metric: "quoted_value" | "price_return_pct" | "yield_change_bps";
    lower: number;
    upper: number;
    evaluation: "at_review" | "every_daily_observation";
  };
  if (prediction.kind === "range") {
    band = {
      metric: prediction.metric,
      lower: prediction.lower,
      upper: prediction.upper,
      evaluation: prediction.evaluation,
    };
  } else {
    const meaning = prediction.meaning;
    if (meaning.kind !== "neutral")
      throw new Error("A position statement has no market-performance score.");
    band = {
      metric: meaning.metric,
      lower: -meaning.tolerance,
      upper: meaning.tolerance,
      evaluation: meaning.evaluation,
    };
  }
  const selected = band.evaluation === "at_review" ? [assetEnd] : [assetStart, ...daily, assetEnd];
  const observations = selected.map((snapshot) => {
    const value =
      band.metric === "quoted_value"
        ? decimal(snapshot.value)
        : change(assetStart.value, snapshot.value, band.metric);
    return {
      snapshotId: snapshot.id,
      sessionDate: snapshot.sessionDate,
      value: finiteNumber(value),
      withinBounds:
        compare(value, decimal(band.lower)) >= 0 && compare(value, decimal(band.upper)) <= 0,
    };
  });
  const endChange =
    band.metric === "quoted_value" ? null : change(assetStart.value, assetEnd.value, band.metric);
  const quote = terms.instrument.quote;
  const measurement: PerformanceMeasurement =
    endChange === null
      ? {
          kind: "quoted_value",
          startValue: assetStart.value,
          endValue: assetEnd.value,
          unit: quote.kind === "yield" ? "percent_yield" : `${quote.currency}/${quote.unit}`,
        }
      : band.metric === "yield_change_bps"
        ? {
            kind: "yield_change",
            assetChangeBps: finiteNumber(endChange),
            benchmarkChangeBps: null,
            relativeChangeBps: null,
          }
        : {
            kind: "price_return",
            assetReturnPct: finiteNumber(endChange),
            benchmarkReturnPct: null,
            excessReturnPp: null,
          };
  return {
    met: observations.every((observation) => observation.withinBounds),
    measurement,
    check: { kind: "band", ...band, boundaries: "inclusive", observations },
  };
}
