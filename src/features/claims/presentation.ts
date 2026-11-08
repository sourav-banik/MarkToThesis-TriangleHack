import type { ConfirmedTerms, Horizon } from "./contracts";
import { formatNumber } from "../../lib/format";

export const predictionLabels = {
  outperform: "Outperform",
  underperform: "Underperform",
  hold: "Hold",
  range: "Range",
} as const;

export function formatHorizon(horizon: Horizon) {
  if (horizon.kind === "date") {
    return `By ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${horizon.targetDate}T00:00:00Z`))}`;
  }
  return `${horizon.value} ${horizon.value === 1 ? horizon.unit.slice(0, -1) : horizon.unit}`;
}

export function describePrediction(terms: ConfirmedTerms) {
  const { instrument, prediction } = terms;
  if (prediction.kind === "outperform" || prediction.kind === "underperform") {
    return `${predictionLabels[prediction.kind]} ${prediction.benchmark.symbol}${prediction.metric === "yield_change_bps" ? " in yield change (bps), not investment return" : " on price return"}`;
  }
  if (prediction.kind === "hold") {
    if (prediction.meaning.kind === "maintain_position")
      return "Maintain position · no performance score";
    const unit = prediction.meaning.metric === "yield_change_bps" ? " bps" : "%";
    return `Within ±${formatNumber(prediction.meaning.tolerance)}${unit} of the start${prediction.meaning.evaluation === "every_daily_observation" ? " at every daily observation" : " at review"}`;
  }
  const suffix =
    prediction.metric === "price_return_pct"
      ? "% return"
      : prediction.metric === "yield_change_bps"
        ? " bps change"
        : instrument.quote.kind === "yield"
          ? "% yield"
          : ` ${instrument.quote.currency} / ${instrument.quote.unit}`;
  return `${formatNumber(prediction.lower)}–${formatNumber(prediction.upper)}${suffix}${prediction.evaluation === "every_daily_observation" ? " at every daily observation" : " at review"}`;
}
