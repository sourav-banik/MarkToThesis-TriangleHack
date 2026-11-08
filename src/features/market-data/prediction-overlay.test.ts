import { describe, expect, it } from "vitest";
import { standardClaimFields } from "@/features/claims/conventions";
import { instruments } from "./catalog";
import { claimChartSchema } from "./chart-contracts";
import { predictionOverlay } from "./prediction-overlay";

function chart() {
  return claimChartSchema.parse({
    asset: {
      symbol: "AAPL",
      points: [
        { date: "2026-11-02", value: 100 },
        { date: "2026-11-06", value: 110 },
      ],
    },
    benchmark: {
      symbol: "SPY",
      points: [
        { date: "2026-11-02", value: 200 },
        { date: "2026-11-06", value: 210 },
      ],
    },
    fromDate: "2026-10-01",
    throughDate: "2026-11-08",
    asOf: "2026-11-08T15:00:00Z",
    committedAt: null,
    adjustment: "split_adjusted_price_return_excluding_dividends",
    terms: {
      ...standardClaimFields,
      instrument: instruments.aapl,
      prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
      horizon: { kind: "duration", value: 30, unit: "days" },
    },
  });
}
describe("prediction chart overlay", () => {
  it("uses a labeled latest-close reference in a draft, with the next eligible start and horizon", () => {
    const overlay = predictionOverlay(chart());
    expect(overlay.referenceDate).toBe("2026-11-06");
    expect(overlay.assetReference).toBe(110);
    expect(overlay.benchmarkReference).toBe(210);
    expect(overlay.startDate).toBe("2026-11-09");
    expect(overlay.reviewDate).toBe("2026-12-09");
    expect(overlay.draft).toBe(true);
  });
  it("keeps a public claim's baseline fixed to the first eligible close, rather than the latest price", () => {
    const data = chart();
    data.committedAt = "2026-11-02T15:00:00Z";
    const overlay = predictionOverlay(data);
    expect(overlay.referenceDate).toBe("2026-11-02");
    expect(overlay.assetReference).toBe(100);
    expect(overlay.benchmarkReference).toBe(200);
  });
  it("does not replace a missing starting session with a later price", () => {
    const data = chart();
    data.committedAt = "2026-11-02T15:00:00Z";
    data.asset.points = [{ date: "2026-11-06", value: 110 }];
    expect(predictionOverlay(data).assetReference).toBeNull();
  });
  it("does not normalize a benchmark using a different session", () => {
    const data = chart();
    data.benchmark!.points = [{ date: "2026-11-02", value: 200 }];
    expect(predictionOverlay(data).benchmarkReference).toBeNull();
  });
  it("uses nominal-price bands for quoted ranges and percent bands for return ranges", () => {
    const data = chart();
    data.terms.prediction = {
      kind: "range",
      lower: 90,
      upper: 120,
      metric: "quoted_value",
      boundaries: "inclusive",
      evaluation: "at_review",
    };
    expect(predictionOverlay(data)).toMatchObject({
      mode: "price",
      band: { lower: 90, upper: 120, unit: "price", daily: false },
    });
    data.terms.prediction = {
      kind: "range",
      lower: -8,
      upper: 12,
      metric: "price_return_pct",
      boundaries: "inclusive",
      evaluation: "every_daily_observation",
    };
    expect(predictionOverlay(data)).toMatchObject({
      mode: "return",
      band: { lower: -8, upper: 12, unit: "return", daily: true },
    });
  });
  it("distinguishes neutral tolerance from an unscored position hold", () => {
    const data = chart();
    data.terms.prediction = {
      kind: "hold",
      meaning: {
        kind: "neutral",
        tolerance: 3,
        metric: "price_return_pct",
        evaluation: "at_review",
      },
    };
    expect(predictionOverlay(data).band).toMatchObject({ lower: -3, upper: 3 });
    data.terms.prediction = { kind: "hold", meaning: { kind: "maintain_position" } };
    expect(predictionOverlay(data).band).toBeNull();
  });
});
