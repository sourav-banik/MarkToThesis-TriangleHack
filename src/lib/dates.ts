/** Format an instant as a calendar date in the observation's saved time zone. */
export function calendarDateAt(instant: string, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    // Zod may run a parent refinement after a nested format refinement has failed.
    // Preserve safeParse's error result instead of throwing during that refinement.
    return null;
  }
}
