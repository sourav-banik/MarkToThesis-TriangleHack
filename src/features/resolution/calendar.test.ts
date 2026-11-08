import { describe, expect, it } from "vitest";
import { targetDateForHorizon, selectMeasurementWindow } from "./calendar";
import { syntheticResolutionRequest } from "../../demo/resolution";

describe("Gregorian horizons", () => {
  it.each([
    ["2024-01-31", 1, "months", "2024-02-29"],
    ["2023-01-31", 1, "months", "2023-02-28"],
    ["2024-02-29", 1, "years", "2025-02-28"],
    ["2024-02-29", 4, "years", "2028-02-29"],
    ["2024-12-31", 2, "months", "2025-02-28"],
    ["2024-03-09", 1, "days", "2024-03-10"],
    ["2024-11-02", 1, "days", "2024-11-03"],
    ["2024-01-02", 25, "years", "2049-01-02"],
    ["2024-01-31", 30, "days", "2024-03-01"],
  ] as const)("%s + %s %s = %s", (start, value, unit, date) => {
    expect(targetDateForHorizon(start, { kind: "duration", value, unit })).toEqual({
      ok: true,
      date,
    });
  });
  it("requires a date horizon to follow the actual selected start", () => {
    expect(targetDateForHorizon("2024-01-03", { kind: "date", targetDate: "2024-01-03" }).ok).toBe(
      false,
    );
    expect(targetDateForHorizon("2024-01-03", { kind: "date", targetDate: "2025-12-31" })).toEqual({
      ok: true,
      date: "2025-12-31",
    });
  });
  it.each([Number.MAX_SAFE_INTEGER, 1e12])(
    "rejects an unrepresentable horizon %s without throwing",
    (value) => {
      for (const unit of ["days", "months", "years"] as const)
        expect(targetDateForHorizon("2024-01-02", { kind: "duration", value, unit }).ok).toBe(
          false,
        );
    },
  );
  it("does not normalize malformed dates or fractional durations", () => {
    expect(
      targetDateForHorizon("2024-02-30", { kind: "duration", value: 1, unit: "days" }).ok,
    ).toBe(false);
    expect(
      targetDateForHorizon("2024-01-01", { kind: "duration", value: 1.5, unit: "days" }).ok,
    ).toBe(false);
  });
});

describe("scheduled measurement windows", () => {
  it("uses replay time for selection while preserving the real logging timestamp", () => {
    const request = syntheticResolutionRequest();
    expect(
      selectMeasurementWindow(
        request.claim,
        request.asset.schedule,
        request.benchmark!.schedule,
        request.asOf,
      ),
    ).toMatchObject({
      kind: "selected",
      window: {
        startSessionDate: "2024-01-02",
        targetDate: "2024-01-03",
        endSessionDate: "2024-01-03",
      },
    });
    expect(request.claim.committedAt).toBe("2026-11-07T14:00:00Z");
  });
  it("excludes a fixing exactly at commitment", () => {
    const request = syntheticResolutionRequest();
    request.claim.context = {
      kind: "replay",
      simulatedCommitmentAt: "2024-01-02T21:00:00Z",
      datasetId: "synthetic",
    };
    expect(
      selectMeasurementWindow(
        request.claim,
        request.asset.schedule,
        request.benchmark!.schedule,
        request.asOf,
      ),
    ).toMatchObject({
      kind: "selected",
      window: { startSessionDate: "2024-01-03", endSessionDate: "2024-01-04" },
    });
  });

  it("requires both starting fixings to follow commitment, even on a common session date", () => {
    const request = syntheticResolutionRequest();
    request.claim.context = {
      kind: "replay",
      simulatedCommitmentAt: "2024-01-02T22:00:00Z",
      datasetId: "synthetic",
    };
    request.benchmark!.schedule.sessions.forEach((session) => {
      session.observedAt = `${session.sessionDate}T23:00:00Z`;
      session.expectedAvailableAt = `${session.sessionDate}T23:05:00Z`;
    });
    expect(
      selectMeasurementWindow(
        request.claim,
        request.asset.schedule,
        request.benchmark!.schedule,
        request.asOf,
      ),
    ).toMatchObject({ kind: "selected", window: { startSessionDate: "2024-01-03" } });
  });

  it("honors schedule-supplied daylight-saving changes instead of adding 24-hour closes", () => {
    const request = syntheticResolutionRequest();
    request.claim.context = {
      kind: "replay",
      simulatedCommitmentAt: "2024-03-08T20:30:00Z",
      datasetId: "synthetic",
    };
    const schedule = structuredClone(request.asset.schedule);
    schedule.coverage = { fromDate: "2024-03-08", throughDate: "2024-03-12" };
    schedule.sessions = [
      {
        sessionDate: "2024-03-08",
        observedAt: "2024-03-08T21:00:00Z",
        expectedAvailableAt: "2024-03-08T21:05:00Z",
      },
      {
        sessionDate: "2024-03-11",
        observedAt: "2024-03-11T20:00:00Z",
        expectedAvailableAt: "2024-03-11T20:05:00Z",
      },
      {
        sessionDate: "2024-03-12",
        observedAt: "2024-03-12T20:00:00Z",
        expectedAvailableAt: "2024-03-12T20:05:00Z",
      },
    ];
    expect(selectMeasurementWindow(request.claim, schedule, null, request.asOf)).toMatchObject({
      kind: "selected",
      window: {
        startSessionDate: "2024-03-08",
        targetDate: "2024-03-09",
        endSessionDate: "2024-03-11",
      },
      assetEnd: { observedAt: "2024-03-11T20:00:00Z" },
    });
  });
  it("moves a weekend target to the next scheduled session", () => {
    const request = syntheticResolutionRequest();
    request.claim.terms.horizon = { kind: "duration", value: 4, unit: "days" };
    expect(
      selectMeasurementWindow(
        request.claim,
        request.asset.schedule,
        request.benchmark!.schedule,
        request.asOf,
      ),
    ).toMatchObject({
      kind: "selected",
      window: { targetDate: "2024-01-06", endSessionDate: "2024-01-08" },
    });
  });
  it("aligns common session dates rather than independently picking endpoints", () => {
    const request = syntheticResolutionRequest();
    request.benchmark!.schedule.sessions = request.benchmark!.schedule.sessions.filter(
      (session) => session.sessionDate !== "2024-01-03",
    );
    expect(
      selectMeasurementWindow(
        request.claim,
        request.asset.schedule,
        request.benchmark!.schedule,
        request.asOf,
      ),
    ).toMatchObject({
      kind: "selected",
      window: { targetDate: "2024-01-03", endSessionDate: "2024-01-04" },
    });
  });
  it("requires coverage back to commitment to rule out omitted starting sessions", () => {
    const request = syntheticResolutionRequest();
    request.asset.schedule.coverage.fromDate = "2024-01-03";
    expect(
      selectMeasurementWindow(
        request.claim,
        request.asset.schedule,
        request.benchmark!.schedule,
        request.asOf,
      ),
    ).toMatchObject({ kind: "pending", reasonCode: "calendar_coverage_missing" });
  });
});
