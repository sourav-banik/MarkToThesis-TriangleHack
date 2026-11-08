import { z } from "zod";
import { horizonSchema, type CommittedClaimVersion, type Horizon } from "../claims/contracts";
import { calendarDateAt } from "../../lib/dates";
import type { ObservationSchedule, ObservationSession, PlannedWindow } from "./contracts";

type DateResult = { ok: true; date: string } | { ok: false; reason: string };
function daysInMonth(year: number, month: number) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
/** Date-only Gregorian arithmetic, independent of the execution host's time zone. */
export function targetDateForHorizon(startDate: string, horizon: Horizon): DateResult {
  if (!z.iso.date().safeParse(startDate).success || !horizonSchema.safeParse(horizon).success)
    return { ok: false, reason: "A valid starting date and horizon are required." };
  if (horizon.kind === "date")
    return horizon.targetDate > startDate
      ? { ok: true, date: horizon.targetDate }
      : { ok: false, reason: "The target must follow the actual starting observation." };
  const [year, month, day] = startDate.split("-").map(Number);
  if (horizon.unit === "days") {
    const timestamp = Date.parse(`${startDate}T00:00:00Z`) + horizon.value * 86_400_000;
    if (!Number.isSafeInteger(timestamp) || timestamp > Date.parse("9999-12-31T00:00:00Z"))
      return { ok: false, reason: "The requested horizon exceeds supported calendar dates." };
    return { ok: true, date: new Date(timestamp).toISOString().slice(0, 10) };
  }
  const months = year * 12 + month - 1 + horizon.value * (horizon.unit === "years" ? 12 : 1);
  const targetYear = Math.floor(months / 12);
  const targetMonth = (months % 12) + 1;
  if (!Number.isSafeInteger(months) || targetYear > 9999)
    return { ok: false, reason: "The requested horizon exceeds supported calendar dates." };
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return {
    ok: true,
    date: `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`,
  };
}

export type SelectedWindow = {
  kind: "selected";
  window: PlannedWindow;
  assetStart: ObservationSession;
  benchmarkStart: ObservationSession | null;
  assetEnd: ObservationSession | null;
  benchmarkEnd: ObservationSession | null;
};
export type WindowSelection =
  | SelectedWindow
  | {
      kind: "pending";
      status: "awaiting_start" | "awaiting_data";
      reasonCode: string;
      reason: string;
    }
  | { kind: "unclear"; reasonCode: string; reason: string };

export function selectMeasurementWindow(
  claim: CommittedClaimVersion,
  asset: ObservationSchedule,
  benchmark: ObservationSchedule | null,
  asOf: string,
): WindowSelection {
  const reference =
    claim.context.kind === "replay" ? claim.context.simulatedCommitmentAt : claim.committedAt;
  for (const schedule of [asset, ...(benchmark ? [benchmark] : [])]) {
    if (
      schedule.coverage.fromDate >
      calendarDateAt(reference, schedule.instrument.observation.timeZone)!
    )
      return {
        kind: "pending",
        status: "awaiting_data",
        reasonCode: "calendar_coverage_missing",
        reason:
          "Calendar coverage must begin on or before commitment so an earlier eligible fixing cannot be skipped.",
      };
  }
  const assetSessions = [...asset.sessions].sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate),
  );
  const benchmarkSessions = new Map(
    benchmark?.sessions.map((session) => [session.sessionDate, session]) ?? [],
  );
  const common = assetSessions.filter(
    (session) => !benchmark || benchmarkSessions.has(session.sessionDate),
  );
  const start = common.find(
    (session) =>
      Date.parse(session.observedAt) > Date.parse(reference) &&
      (!benchmark ||
        Date.parse(benchmarkSessions.get(session.sessionDate)!.observedAt) > Date.parse(reference)),
  );
  if (!start) {
    const stale = [asset, ...(benchmark ? [benchmark] : [])].some(
      (schedule) =>
        schedule.coverage.throughDate <
        calendarDateAt(asOf, schedule.instrument.observation.timeZone)!,
    );
    return {
      kind: "pending",
      status: stale ? "awaiting_data" : "awaiting_start",
      reasonCode: stale ? "calendar_coverage_missing" : "no_eligible_start",
      reason: "No eligible shared starting session is covered by the supplied calendars.",
    };
  }
  const target = targetDateForHorizon(start.sessionDate, claim.terms.horizon);
  if (!target.ok)
    return { kind: "unclear", reasonCode: "invalid_measurement_window", reason: target.reason };
  const end = common.find((session) => session.sessionDate >= target.date);
  return {
    kind: "selected",
    window: {
      startSessionDate: start.sessionDate,
      targetDate: target.date,
      endSessionDate: end?.sessionDate ?? null,
    },
    assetStart: start,
    benchmarkStart: benchmarkSessions.get(start.sessionDate) ?? null,
    assetEnd: end ?? null,
    benchmarkEnd: end ? (benchmarkSessions.get(end.sessionDate) ?? null) : null,
  };
}
