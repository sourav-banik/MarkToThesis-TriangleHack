import type { Instrument, PriceSnapshot } from "./contracts";
import { observationScheduleSchema, type ObservationSchedule } from "../resolution/contracts";

const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const nthWeekday = (year: number, month: number, weekday: number, nth: number) => {
  const first = new Date(Date.UTC(year, month - 1, 1));
  return new Date(Date.UTC(year, month - 1, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (nth - 1) * 7));
};
const lastWeekday = (year: number, month: number, weekday: number) => {
  const last = new Date(Date.UTC(year, month, 0));
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7)));
};
function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Date.UTC(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1));
}
function observedFixed(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  return weekday === 6 ? iso(new Date(date.getTime() - dayMs)) : weekday === 0 ? iso(new Date(date.getTime() + dayMs)) : iso(date);
}
export function nyseHolidayDates(year: number) {
  const easter = easterSunday(year);
  return new Set([
    observedFixed(year, 1, 1),
    iso(nthWeekday(year, 1, 1, 3)),
    iso(nthWeekday(year, 2, 1, 3)),
    iso(new Date(easter.getTime() - 2 * dayMs)),
    iso(lastWeekday(year, 5, 1)),
    observedFixed(year, 6, 19),
    observedFixed(year, 7, 4),
    iso(nthWeekday(year, 9, 1, 1)),
    iso(nthWeekday(year, 11, 4, 4)),
    observedFixed(year, 12, 25),
  ]);
}
export function buildNyseSchedule(instrument: Instrument, fromDate: string, throughDate: string, snapshots: PriceSnapshot[]): ObservationSchedule {
  const byDate = new Map(snapshots.map((snapshot) => [snapshot.sessionDate, snapshot]));
  const sessions: ObservationSchedule["sessions"] = [];
  for (let cursor = utcDate(fromDate); iso(cursor) <= throughDate; cursor = new Date(cursor.getTime() + dayMs)) {
    const date = iso(cursor);
    if (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6 || nyseHolidayDates(cursor.getUTCFullYear()).has(date)) continue;
    const snapshot = byDate.get(date);
    const observedAt = snapshot?.observedAt ?? `${date}T00:00:00.000Z`;
    sessions.push({ sessionDate: date, observedAt, expectedAvailableAt: snapshot?.availableAt ?? new Date(Date.parse(observedAt) + dayMs).toISOString() });
  }
  return observationScheduleSchema.parse({
    id: `massive:nyse:${instrument.id}:${fromDate}:${throughDate}`,
    version: "massive-nyse-v1",
    instrument,
    source: { provider: "massive", seriesId: instrument.symbol, isSynthetic: false },
    coverage: { fromDate, throughDate },
    completeness: "complete_for_coverage",
    sessions,
  });
}
