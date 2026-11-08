import type { Instrument, PriceSnapshot } from "./contracts";
import { observationScheduleSchema, type ObservationSchedule } from "../resolution/contracts";

const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const nthWeekday = (year: number, month: number, weekday: number, nth: number) => {
  const first = new Date(Date.UTC(year, month - 1, 1));
  return new Date(
    Date.UTC(year, month - 1, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (nth - 1) * 7),
  );
};
const lastWeekday = (year: number, month: number, weekday: number) => {
  const last = new Date(Date.UTC(year, month, 0));
  return new Date(
    Date.UTC(year, month - 1, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7)),
  );
};
function easterSunday(year: number) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4;
  const f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(
    Date.UTC(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1),
  );
}
function observedFixed(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  return weekday === 6
    ? iso(new Date(date.getTime() - dayMs))
    : weekday === 0
      ? iso(new Date(date.getTime() + dayMs))
      : iso(date);
}
export function nyseHolidayDates(year: number) {
  const easter = easterSunday(year);
  return new Set([
    // NYSE does not observe a Saturday New Year's Day on the prior Friday.
    ...(new Date(Date.UTC(year, 0, 1)).getUTCDay() === 6 ? [] : [observedFixed(year, 1, 1)]),
    iso(nthWeekday(year, 1, 1, 3)),
    iso(nthWeekday(year, 2, 1, 3)),
    iso(new Date(easter.getTime() - 2 * dayMs)),
    iso(lastWeekday(year, 5, 1)),
    observedFixed(year, 6, 19),
    observedFixed(year, 7, 4),
    iso(nthWeekday(year, 9, 1, 1)),
    iso(nthWeekday(year, 11, 4, 4)),
    observedFixed(year, 12, 25),
    ...(year === 2025 ? ["2025-01-09"] : []), // National Day of Mourning.
  ]);
}
const earlyCloses = new Set([
  "2024-07-03",
  "2024-11-29",
  "2024-12-24",
  "2025-07-03",
  "2025-11-28",
  "2025-12-24",
  "2026-11-27",
  "2026-12-24",
  "2027-11-26",
  "2028-07-03",
  "2028-11-24",
]);
export function nyseCloseAt(date: string) {
  const noon = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  })
    .formatToParts(noon)
    .find((part) => part.type === "timeZoneName")!.value;
  const utcHour = (earlyCloses.has(date) ? 13 : 16) + (offset === "GMT-4" ? 4 : 5);
  return `${date}T${utcHour}:00:00.000Z`;
}
export function nyseAvailableAt(date: string) {
  const nextDate = iso(new Date(Date.parse(`${date}T00:00:00Z`) + dayMs));
  // Conservative EOD publication cutoff: next local midnight.
  const closeHour = Number(nyseCloseAt(nextDate).slice(11, 13));
  const offset = closeHour - (earlyCloses.has(nextDate) ? 13 : 16);
  return `${nextDate}T0${offset}:00:00.000Z`;
}
export function buildNyseSchedule(
  instrument: Instrument,
  fromDate: string,
  throughDate: string,
  snapshots: PriceSnapshot[],
): ObservationSchedule {
  // Coverage is deliberately bounded to audited holiday/exception dates.
  if (fromDate < "2024-01-01" || throughDate > "2028-12-31")
    throw new Error(
      "Exchange calendar coverage is available for 2024–2028 only. Extend the calendar before resolving this window.",
    );
  void snapshots; // Calendar never infers sessions or fixing times from prices.
  const sessions: ObservationSchedule["sessions"] = [];
  for (
    let cursor = utcDate(fromDate);
    iso(cursor) <= throughDate;
    cursor = new Date(cursor.getTime() + dayMs)
  ) {
    const date = iso(cursor);
    if (
      cursor.getUTCDay() === 0 ||
      cursor.getUTCDay() === 6 ||
      nyseHolidayDates(cursor.getUTCFullYear()).has(date)
    )
      continue;
    sessions.push({
      sessionDate: date,
      observedAt: nyseCloseAt(date),
      expectedAvailableAt: nyseAvailableAt(date),
    });
  }
  return observationScheduleSchema.parse({
    id: `massive:nyse:${instrument.id}:${fromDate}:${throughDate}`,
    version: "nyse-2024-2028-v2",
    instrument,
    source: { provider: "massive", seriesId: instrument.symbol, isSynthetic: false },
    coverage: { fromDate, throughDate },
    completeness: "complete_for_coverage",
    sessions,
  });
}
