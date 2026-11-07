import { describe, expect, it } from "vitest";
import { syntheticResolutionRequest, syntheticSeries } from "../../demo/resolution";
import { instruments } from "../market-data/catalog";
import type { Instrument, PriceSnapshot } from "../market-data/contracts";
import type { Prediction } from "../claims/contracts";
import { resolveClaim, FORMULA_VERSION } from "./resolve";
import { observationScheduleSchema, resolutionSchema, type ResolutionRequest } from "./contracts";

const observations = (series: ResolutionRequest["asset"]) => series.observations as PriceSnapshot[];
function single(
  prediction: Prediction,
  instrument: Instrument = instruments.aapl,
  values = [100, 110],
) {
  const request = syntheticResolutionRequest();
  request.claim.terms.instrument = instrument;
  request.claim.terms.prediction = prediction;
  request.asset = syntheticSeries(instrument, values);
  request.benchmark = null;
  if (
    prediction.kind === "range" &&
    prediction.metric === "quoted_value" &&
    instrument.quote.kind === "price"
  ) {
    observations(request.asset).forEach((snapshot) => {
      snapshot.adjustment = "unadjusted";
    });
  }
  return request;
}
function neutral(evaluation: "at_review" | "every_daily_observation" = "at_review"): Prediction {
  return {
    kind: "hold",
    meaning: { kind: "neutral", tolerance: 10, metric: "price_return_pct", evaluation },
  };
}
function range(evaluation: "at_review" | "every_daily_observation" = "at_review"): Prediction {
  return {
    kind: "range",
    lower: 95,
    upper: 110,
    metric: "quoted_value",
    boundaries: "inclusive",
    evaluation,
  };
}
function scored(request: ResolutionRequest, status: "met" | "not_met" = "met") {
  const result = resolveClaim(request);
  expect(result.status).toBe(status);
  if (!("resolution" in result) || !("inputs" in result.resolution))
    throw new Error(JSON.stringify(result));
  expect(resolutionSchema.safeParse(result.resolution).success).toBe(true);
  return result.resolution;
}
function live(asOf: string) {
  const request = syntheticResolutionRequest();
  request.claim.committedAt = "2024-01-02T20:00:00Z";
  request.claim.publishedAt = request.claim.committedAt;
  request.claim.context = { kind: "live" };
  request.asOf = asOf;
  return request;
}

describe("relative performance", () => {
  it("calculates price returns and excess return in percentage points", () => {
    const result = scored(syntheticResolutionRequest());
    expect(result.measurement).toEqual({
      kind: "price_return",
      assetReturnPct: 10,
      benchmarkReturnPct: 5,
      excessReturnPp: 5,
    });
    expect(result.formulaVersion).toBe(FORMULA_VERSION);
    expect(result.context.kind).toBe("replay");
    expect(result.committedAt).toBe("2026-11-07T14:00:00Z");
    expect(result.inputs.assetStart.source.isSynthetic).toBe(true);
    expect(result.inputs.window).toEqual({
      startSessionDate: "2024-01-02",
      targetDate: "2024-01-03",
      endSessionDate: "2024-01-03",
    });
  });
  it("resolves underperformance using a strictly negative relative result", () => {
    const request = syntheticResolutionRequest();
    request.claim.terms.prediction = {
      kind: "underperform",
      benchmark: instruments.spy,
      metric: "price_return",
    };
    observations(request.asset)[1].value = 90;
    expect(scored(request).measurement).toMatchObject({ assetReturnPct: -10, excessReturnPp: -15 });
  });
  it.each(["outperform", "underperform"] as const)("does not count a tie as %s", (kind) => {
    const request = syntheticResolutionRequest();
    request.claim.terms.prediction = { kind, benchmark: instruments.spy, metric: "price_return" };
    observations(request.asset)[0].value = 0.1;
    observations(request.asset)[1].value = 0.11;
    observations(request.benchmark!)[1].value = 110;
    expect(scored(request, "not_met").measurement).toMatchObject({ excessReturnPp: 0 });
  });
  it("allows outperformance while both instruments decline", () => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].value = 90;
    observations(request.benchmark!)[1].value = 80;
    expect(scored(request).measurement).toMatchObject({
      assetReturnPct: -10,
      benchmarkReturnPct: -20,
      excessReturnPp: 10,
    });
  });
  it("does not round a small positive excess into a tie", () => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].value = 100.000000001;
    observations(request.benchmark!)[1].value = 100;
    expect(scored(request).measurement).toMatchObject({ excessReturnPp: 1e-9 });
  });
  it("compares yield changes in bps without inventing bond returns", () => {
    const request = single(
      { kind: "outperform", benchmark: instruments.treasury10y, metric: "yield_change_bps" },
      instruments.treasury5y,
      [4, 4.25],
    );
    request.benchmark = syntheticSeries(instruments.treasury10y, [4, 4.1]);
    expect(scored(request).measurement).toEqual({
      kind: "yield_change",
      assetChangeBps: 25,
      benchmarkChangeBps: 10,
      relativeChangeBps: 15,
    });
  });
});

describe("hold and range conditions", () => {
  it("scores a neutral hold inclusively at an exact decimal boundary", () => {
    expect(scored(single(neutral(), instruments.aapl, [100, 110])).check).toMatchObject({
      kind: "band",
      lower: -10,
      upper: 10,
      observations: [{ value: 10, withinBounds: true }],
    });
  });
  it("keeps a position-only hold unscored even without prices", () => {
    const request = single({ kind: "hold", meaning: { kind: "maintain_position" } });
    request.asset.observations = [];
    const result = resolveClaim({
      resolutionId: request.resolutionId,
      claim: request.claim,
      asOf: request.asOf,
    });
    expect(result).toMatchObject({
      status: "unscored",
      resolution: {
        outcome: "unscored",
        reason: "position_statement_without_measurable_condition",
      },
    });
    if ("resolution" in result) expect(result.resolution).not.toHaveProperty("measurement");
  });
  it.each([95, 110])("includes quoted-value range boundary %s", (ending) => {
    expect(scored(single(range(), instruments.aapl, [100, ending])).measurement).toEqual({
      kind: "quoted_value",
      startValue: 100,
      endValue: ending,
      unit: "USD/share",
    });
  });
  it("does not equate an endpoint range with every-day compliance", () => {
    const request = single(range(), instruments.aapl, [100, 120, 100, 105]);
    request.claim.terms.horizon = { kind: "duration", value: 3, unit: "days" };
    scored(request);
    request.claim.terms.prediction = range("every_daily_observation");
    const result = scored(request, "not_met");
    expect(result.inputs.intermediateObservations).toHaveLength(2);
    expect(result.check).toMatchObject({
      observations: [
        { withinBounds: true },
        { withinBounds: false },
        { withinBounds: true },
        { withinBounds: true },
      ],
    });
  });
  it("includes the starting observation in an every-day quoted range", () => {
    const prediction: Prediction = {
      kind: "range",
      lower: 105,
      upper: 115,
      metric: "quoted_value",
      boundaries: "inclusive",
      evaluation: "every_daily_observation",
    };
    scored(single(prediction, instruments.aapl, [100, 110]), "not_met");
  });
  it("checks neutral-hold breaches during the window", () => {
    const request = single(neutral("every_daily_observation"), instruments.aapl, [100, 111, 105]);
    request.claim.terms.horizon = { kind: "duration", value: 2, unit: "days" };
    scored(request, "not_met");
    request.claim.terms.prediction = neutral("at_review");
    scored(request);
  });
  it("scores percentage-return bands independently of quoted price ranges", () => {
    const prediction: Prediction = {
      kind: "range",
      lower: 5,
      upper: 10,
      metric: "price_return_pct",
      boundaries: "inclusive",
      evaluation: "at_review",
    };
    expect(scored(single(prediction, instruments.aapl, [200, 220])).check).toMatchObject({
      metric: "price_return_pct",
      observations: [{ value: 10 }],
    });
  });
  it("handles negative yields and exact bps tolerance boundaries", () => {
    const prediction: Prediction = {
      kind: "hold",
      meaning: {
        kind: "neutral",
        tolerance: 10,
        metric: "yield_change_bps",
        evaluation: "at_review",
      },
    };
    expect(
      scored(single(prediction, instruments.treasury5y, [-0.2, -0.1])).measurement,
    ).toMatchObject({ kind: "yield_change", assetChangeBps: 10 });
  });
  it("handles yield-level ranges in percent", () => {
    const prediction: Prediction = {
      kind: "range",
      lower: 3.5,
      upper: 4.5,
      metric: "quoted_value",
      boundaries: "inclusive",
      evaluation: "at_review",
    };
    expect(scored(single(prediction, instruments.treasury5y, [4, 4.5])).measurement).toMatchObject({
      kind: "quoted_value",
      endValue: 4.5,
      unit: "percent_yield",
    });
  });
  it("evaluates an absolute oil range even with a zero start and negative end", () => {
    const prediction: Prediction = {
      kind: "range",
      lower: -20,
      upper: 0,
      metric: "quoted_value",
      boundaries: "inclusive",
      evaluation: "at_review",
    };
    expect(scored(single(prediction, instruments.wti, [0, -10])).measurement).toMatchObject({
      kind: "quoted_value",
      endValue: -10,
    });
  });
  it.each([0, -10])("leaves percentage performance unclear for starting price %s", (starting) => {
    expect(resolveClaim(single(neutral(), instruments.wti, [starting, 10]))).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "unsupported_calculation" },
    });
  });
});

describe("lifecycle and missing data", () => {
  it("waits for the scheduled Monday fixing when the target is a Saturday", () => {
    const request = live("2024-01-06T23:00:00Z");
    request.claim.terms.horizon = { kind: "duration", value: 4, unit: "days" };
    expect(resolveClaim(request)).toMatchObject({
      status: "active",
      reasonCode: "review_fixing_pending",
      window: { targetDate: "2024-01-06", endSessionDate: "2024-01-08" },
    });
  });

  it("aligns a 24/7 asset with exchange sessions without using the crypto-only weekend", () => {
    const request = syntheticResolutionRequest();
    request.claim.terms.instrument = instruments.btc;
    request.asset = syntheticSeries(instruments.btc, [100, 110, 120, 130, 900, 900, 140]);
    request.claim.terms.horizon = { kind: "duration", value: 4, unit: "days" };
    const result = scored(request);
    expect(result.inputs.window.endSessionDate).toBe("2024-01-08");
    expect(result.measurement).toMatchObject({ kind: "price_return", assetReturnPct: 40 });
  });

  it("includes weekend observations when a crypto range promises every daily fixing", () => {
    const request = single(
      range("every_daily_observation"),
      instruments.btc,
      [100, 100, 100, 100, 120, 100],
    );
    request.claim.terms.horizon = { kind: "duration", value: 5, unit: "days" };
    expect(scored(request, "not_met").check).toMatchObject({
      observations: [
        { withinBounds: true },
        { withinBounds: true },
        { withinBounds: true },
        { withinBounds: true },
        { sessionDate: "2024-01-06", withinBounds: false },
        { withinBounds: true },
      ],
    });
  });

  it("waits for the benchmark fixing if its same-date observation occurs later", () => {
    const request = live("2024-01-03T22:00:00Z");
    request.claim.terms.prediction = {
      kind: "outperform",
      benchmark: instruments.btc,
      metric: "price_return",
    };
    request.benchmark = syntheticSeries(instruments.btc, [100, 105]);
    request.benchmark.schedule.sessions.forEach((session) => {
      session.observedAt = `${session.sessionDate}T23:00:00Z`;
      session.expectedAvailableAt = `${session.sessionDate}T23:05:00Z`;
    });
    observations(request.benchmark).forEach((snapshot) => {
      snapshot.observedAt = `${snapshot.sessionDate}T23:00:00Z`;
      snapshot.availableAt = `${snapshot.sessionDate}T23:05:00Z`;
      snapshot.retrievedAt = `${snapshot.sessionDate}T23:10:00Z`;
    });
    expect(resolveClaim(request)).toMatchObject({
      status: "active",
      reasonCode: "review_fixing_pending",
    });
  });

  it.each([
    ["2024-01-02T20:30:00Z", "awaiting_start"],
    ["2024-01-02T21:02:00Z", "awaiting_data"],
    ["2024-01-02T21:15:00Z", "active"],
    ["2024-01-03T21:02:00Z", "awaiting_data"],
    ["2024-01-03T21:15:00Z", "met"],
  ])("at %s returns %s", (asOf, status) => {
    expect(resolveClaim(live(asOf)).status).toBe(status);
  });
  it("never substitutes a later starting price when the required start is missing", () => {
    const request = syntheticResolutionRequest();
    request.asset.observations.shift();
    expect(resolveClaim(request)).toMatchObject({
      status: "awaiting_data",
      window: { startSessionDate: "2024-01-02" },
      missingObservations: [{ sessionDate: "2024-01-02" }],
    });
  });
  it("never substitutes a later end price when the required ending session is missing", () => {
    const request = syntheticResolutionRequest();
    request.asset.observations.splice(1, 1);
    expect(resolveClaim(request)).toMatchObject({
      status: "awaiting_data",
      window: { endSessionDate: "2024-01-03" },
      missingObservations: [{ sessionDate: "2024-01-03" }],
    });
  });
  it("requires all scheduled intermediate prices for a daily-range claim", () => {
    const request = single(range("every_daily_observation"));
    request.claim.terms.horizon = { kind: "duration", value: 3, unit: "days" };
    request.asset.observations.splice(1, 1);
    expect(resolveClaim(request)).toMatchObject({
      status: "awaiting_data",
      missingObservations: [{ sessionDate: "2024-01-03" }],
    });
  });
  it("does not use observations retrieved after the evaluation clock", () => {
    const request = live("2024-01-03T22:00:00Z");
    observations(request.asset)[1].retrievedAt = "2025-01-01T00:00:00Z";
    expect(resolveClaim(request)).toMatchObject({
      status: "awaiting_data",
      missingObservations: [{ sessionDate: "2024-01-03" }],
    });
  });

  it("keeps delayed Treasury publications pending after their observation date", () => {
    const request = single(
      {
        kind: "range",
        lower: 3,
        upper: 5,
        metric: "quoted_value",
        boundaries: "inclusive",
        evaluation: "at_review",
      },
      instruments.treasury5y,
      [4, 4.1],
    );
    request.claim.committedAt = "2024-01-02T20:00:00Z";
    request.claim.publishedAt = request.claim.committedAt;
    request.claim.context = { kind: "live" };
    request.asOf = "2024-01-04T12:00:00Z";
    observations(request.asset)[1].availableAt = "2024-01-04T18:00:00Z";
    observations(request.asset)[1].retrievedAt = "2024-01-04T18:01:00Z";
    expect(resolveClaim(request)).toMatchObject({
      status: "awaiting_data",
      missingObservations: [{ sessionDate: "2024-01-03" }],
    });
  });
  it("waits for calendar coverage instead of selecting from an incomplete price list", () => {
    const request = syntheticResolutionRequest();
    request.claim.terms.horizon = { kind: "duration", value: 10, unit: "days" };
    expect(resolveClaim(request)).toMatchObject({
      status: "awaiting_data",
      reasonCode: "calendar_coverage_missing",
    });
  });
  it("remains active for a multi-year target beyond currently supplied calendar coverage", () => {
    const request = syntheticResolutionRequest();
    request.claim.terms.horizon = { kind: "duration", value: 5, unit: "years" };
    expect(resolveClaim(request)).toMatchObject({
      status: "active",
      window: { targetDate: "2029-01-02", endSessionDate: null },
    });
  });
  it("rejects an explicit target not after the selected starting fixing", () => {
    const request = syntheticResolutionRequest();
    request.claim.context = {
      kind: "replay",
      simulatedCommitmentAt: "2024-01-02T22:00:00Z",
      datasetId: "synthetic",
    };
    request.claim.terms.horizon = { kind: "date", targetDate: "2024-01-03" };
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "invalid_measurement_window" },
    });
  });
});

describe("data integrity and reproducibility", () => {
  it("does not modify inputs and produces identical results for repeated calls", () => {
    const request = syntheticResolutionRequest();
    const before = JSON.stringify(request);
    const first = resolveClaim(request);
    expect(resolveClaim(request)).toEqual(first);
    expect(JSON.stringify(request)).toBe(before);
    request.asset.observations.reverse();
    expect(resolveClaim(request)).toEqual(first);
  });
  it("does not silently pick among conflicting revisions", () => {
    const request = syntheticResolutionRequest();
    const snapshot = structuredClone(observations(request.asset)[1]);
    snapshot.id = "correction";
    snapshot.value = 90;
    request.asset.observations.push(snapshot);
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "conflicting_observations" },
    });
  });

  it("rejects a reused snapshot ID across different dates", () => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].id = observations(request.asset)[0].id;
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "conflicting_observation_ids" },
    });
  });

  it("does not score a comparison without its committed benchmark series", () => {
    const request = syntheticResolutionRequest();
    request.benchmark = null;
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "benchmark_mismatch" },
    });
  });
  it("accepts economically identical duplicates without order-dependent selection", () => {
    const request = syntheticResolutionRequest();
    const duplicate = structuredClone(observations(request.asset)[1]);
    duplicate.id = "another-identical-copy";
    request.asset.observations.push(duplicate);
    const first = scored(request);
    request.asset.observations.reverse();
    expect(scored(request)).toEqual(first);
  });
  it.each(["provider", "seriesId"] as const)("rejects a substituted %s", (field) => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].source[field] = "different";
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "source_mismatch" },
    });
  });
  it("rejects an altered instrument identity even when its ID is unchanged", () => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].instrument.definition = "A different security or fixing.";
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "instrument_mismatch" },
    });
  });
  it("rejects observations from an unsaved fixing time", () => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].observedAt = "2024-01-03T20:00:00Z";
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "fixing_mismatch" },
    });
  });
  it("requires compatible split-adjustment bases", () => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].adjustmentBasisId = "a-later-split-basis";
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "incompatible_adjustments" },
    });
  });
  it.each(["unadjusted", "total_return"] as const)(
    "rejects %s equity observations for price-return performance",
    (adjustment) => {
      const request = syntheticResolutionRequest();
      observations(request.asset).forEach((snapshot) => {
        snapshot.adjustment = adjustment;
      });
      expect(resolveClaim(request)).toMatchObject({
        status: "unclear",
        resolution: { reasonCode: "incompatible_adjustments" },
      });
    },
  );
  it("requires nominal observations for literal quote-level ranges", () => {
    const request = single(range());
    observations(request.asset).forEach((snapshot) => {
      snapshot.adjustment = "split_adjusted";
    });
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "incompatible_adjustments" },
    });
  });
  it.each([NaN, Infinity, -1])("does not score invalid equity value %s as a loss", (value) => {
    const request = syntheticResolutionRequest();
    observations(request.asset)[1].value = value;
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "invalid_observation" },
    });
  });
  it("returns validation issues for malformed requests without inventing a claim ID", () => {
    expect(resolveClaim({})).toMatchObject({ status: "invalid_input" });
    const request = syntheticResolutionRequest();
    request.asOf = "2025-01-01T00:00:00Z";
    expect(resolveClaim(request)).toMatchObject({
      status: "invalid_input",
      issues: [{ path: "asOf" }],
    });
  });
  it("never enables the reserved dividend-inclusive convention", () => {
    const request = syntheticResolutionRequest();
    request.claim.terms.returnConvention = {
      kind: "total_return",
      dividends: "reinvested",
      splits: "adjusted",
      methodologyId: "not-implemented",
    };
    expect(resolveClaim(request).status).toBe("invalid_input");
  });
  it("rejects a UTC daily schedule with a silently omitted weekend", () => {
    const schedule = syntheticSeries(instruments.btc).schedule;
    schedule.sessions = schedule.sessions.filter((session) => session.sessionDate !== "2024-01-06");
    expect(observationScheduleSchema.safeParse(schedule).success).toBe(false);
  });
  it("fails explicitly when a horizon cannot be represented", () => {
    const request = syntheticResolutionRequest();
    request.claim.terms.horizon = {
      kind: "duration",
      value: Number.MAX_SAFE_INTEGER,
      unit: "years",
    };
    expect(resolveClaim(request)).toMatchObject({
      status: "unclear",
      resolution: { reasonCode: "invalid_measurement_window" },
    });
  });
});
