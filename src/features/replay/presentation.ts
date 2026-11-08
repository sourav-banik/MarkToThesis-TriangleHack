import type { ResolutionAttempt } from "../resolution/contracts";
import { evaluateReplay, type ReplayRecord } from "./dataset";

export function formatReplayTime(value: string) {
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "America/New_York",
    }).format(new Date(value)) + " ET"
  );
}
export function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
export function formatMetric(value: number, unit = "%", signed = true) {
  const number =
    value !== 0 && Math.abs(value) < 0.005
      ? value.toExponential(2)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return `${signed && value > 0 ? "+" : ""}${number}${unit}`;
}
export const replayStatusLabels = {
  ready: "Ready to resolve",
  met: "Met",
  not_met: "Not met",
  unclear: "Unclear",
  unscored: "Unscored",
  awaiting_data: "Awaiting data",
  awaiting_start: "Awaiting start",
  active: "Active",
  invalid_input: "Invalid input",
} as const;
export function replayTone(
  status: ResolutionAttempt["status"] | "ready",
): "green" | "amber" | "muted" | "purple" {
  return status === "met"
    ? "green"
    : status === "not_met" || status === "unclear" || status === "invalid_input"
      ? "amber"
      : status === "ready"
        ? "purple"
        : "muted";
}
export function replayCounts(records: ReplayRecord[]) {
  const counts = { met: 0, not_met: 0, unclear: 0, pending: 0, unscored: 0 };
  for (const record of records) {
    const attempt = evaluateReplay(record);
    if (
      attempt?.status === "met" ||
      attempt?.status === "not_met" ||
      attempt?.status === "unclear" ||
      attempt?.status === "unscored"
    )
      counts[attempt.status]++;
    else counts.pending++;
  }
  return counts;
}
