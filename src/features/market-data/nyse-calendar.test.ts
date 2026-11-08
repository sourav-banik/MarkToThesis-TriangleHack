import { describe, expect, it } from "vitest";
import { buildNyseSchedule, nyseCloseAt, nyseHolidayDates } from "./nyse-calendar";
import { instruments } from "./catalog";

describe("independent US session schedule", () => {
  it("retains missing sessions with real close times and applies daylight saving", () => {
    const schedule = buildNyseSchedule(instruments.aapl, "2026-03-06", "2026-03-09", []);
    expect(schedule.sessions.map((session) => session.observedAt)).toEqual([
      "2026-03-06T21:00:00.000Z",
      "2026-03-09T20:00:00.000Z",
    ]);
  });
  it("accounts for early closes and the 2025 exceptional closure", () => {
    expect(nyseCloseAt("2026-11-27")).toBe("2026-11-27T18:00:00.000Z");
    expect(nyseHolidayDates(2025).has("2025-01-09")).toBe(true);
    expect(
      buildNyseSchedule(instruments.aapl, "2025-01-09", "2025-01-10", []).sessions.map(
        (session) => session.sessionDate,
      ),
    ).toEqual(["2025-01-10"]);
  });
  it("rejects calendar dates outside the reviewed coverage", () => {
    expect(() => buildNyseSchedule(instruments.aapl, "2023-01-01", "2023-01-10", [])).toThrow(
      "coverage",
    );
  });
});
