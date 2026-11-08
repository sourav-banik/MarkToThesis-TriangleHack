import { describe, expect, it } from "vitest";
import { instruments } from "./catalog";
import { instrumentSchema, priceSnapshotSchema } from "./contracts";

const snapshot = {
  id: "synthetic-price",
  instrument: instruments.aapl,
  value: 100,
  sessionDate: "2026-11-06",
  observedAt: "2026-11-06T21:00:00Z",
  availableAt: "2026-11-06T21:05:00Z",
  retrievedAt: "2026-11-07T12:00:00Z",
  source: {
    provider: "test-fixture",
    seriesId: "synthetic-aapl",
    sourceUrl: "https://example.com/synthetic",
    isSynthetic: true,
  },
  adjustment: "split_adjusted",
  adjustmentBasisId: "test-basis-v1",
};

describe("market observations", () => {
  it("requires a concrete definition and calendar for instrument identity", () => {
    expect(instrumentSchema.safeParse({ ...instruments.gold, definition: "" }).success).toBe(false);
    expect(
      instrumentSchema.safeParse({
        ...instruments.btc,
        observation: { ...instruments.btc.observation, timeZone: "made-up" },
      }).success,
    ).toBe(false);
  });
  it("does not treat a yield series as a priced security", () => {
    expect(
      instrumentSchema.safeParse({ ...instruments.treasury5y, quote: instruments.aapl.quote })
        .success,
    ).toBe(false);
  });
  it("keeps observation time separate from publication time", () => {
    expect(priceSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      priceSnapshotSchema.safeParse({ ...snapshot, availableAt: "2026-11-06T20:00:00Z" }).success,
    ).toBe(false);
  });
  it("rejects zero/negative equity observations", () => {
    expect(priceSnapshotSchema.safeParse({ ...snapshot, value: 0 }).success).toBe(false);
    expect(priceSnapshotSchema.safeParse({ ...snapshot, value: -1 }).success).toBe(false);
  });
  it("allows explicitly signed commodity prices without assuming a valid return", () => {
    expect(
      priceSnapshotSchema.safeParse({
        ...snapshot,
        instrument: instruments.wti,
        value: -10,
        adjustment: "unadjusted",
      }).success,
    ).toBe(true);
  });
  it("permits negative yield levels and rejects price adjustments on yield observations", () => {
    expect(
      priceSnapshotSchema.safeParse({
        ...snapshot,
        instrument: instruments.treasury5y,
        value: -0.1,
        adjustment: "not_applicable",
      }).success,
    ).toBe(true);
    expect(
      priceSnapshotSchema.safeParse({ ...snapshot, instrument: instruments.treasury5y }).success,
    ).toBe(false);
  });
});
