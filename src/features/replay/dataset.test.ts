import { describe, expect, it } from "vitest";
import {
  createReplayRecord,
  evaluateReplay,
  initialReplayTerms,
  replayRecordSchema,
  seedReplayRecords,
  REPLAY_DATASET_ID,
} from "./dataset";
import { replayCounts } from "./presentation";

describe("synthetic replay integration", () => {
  it("runs the full preloaded history through the real resolver, including misses and unclear calls", () => {
    const records = seedReplayRecords();
    expect(records.map((record) => evaluateReplay(record)?.status)).toEqual([
      "met",
      "not_met",
      "met",
      "not_met",
      "unclear",
      "awaiting_data",
      "unscored",
    ]);
    expect(replayCounts(records)).toEqual({
      met: 2,
      not_met: 2,
      unclear: 1,
      pending: 1,
      unscored: 1,
    });
  });
  it("creates a detached locked copy without backdating or publishing", () => {
    const terms = initialReplayTerms();
    const record = createReplayRecord(
      terms,
      "My original words.",
      "replay-test",
      "2026-11-07T18:00:00Z",
    );
    terms.horizon = { kind: "duration", value: 9, unit: "years" };
    expect(record.claim.terms.horizon).toEqual({ kind: "duration", value: 3, unit: "days" });
    expect(record.claim.originalText).toBe("My original words.");
    expect(record.claim.committedAt).toBe("2026-11-07T18:00:00Z");
    expect(record.claim.context).toEqual({
      kind: "replay",
      simulatedCommitmentAt: "2024-01-02T20:00:00Z",
      datasetId: REPLAY_DATASET_ID,
    });
    expect(record.claim.visibility).toBe("private");
    expect(record.claim.publishedAt).toBeNull();
    expect(evaluateReplay(record)).toBeNull();
  });
  it("calculates from the versioned dataset without mutating saved terms", () => {
    const record = {
      ...createReplayRecord(
        initialReplayTerms(),
        "Apple should do better.",
        "replay-test",
        "2026-11-07T18:00:00Z",
      ),
      resolvedAt: "2026-11-07T18:01:00Z",
    };
    const before = JSON.stringify(record);
    const result = evaluateReplay(record);
    expect(result).toMatchObject({
      status: "met",
      resolution: {
        measurement: {
          kind: "price_return",
          assetReturnPct: 10,
          benchmarkReturnPct: 5,
          excessReturnPp: 5,
        },
      },
    });
    expect(evaluateReplay(record)).toEqual(result);
    expect(JSON.stringify(record)).toBe(before);
  });
  it("preserves missing-data results instead of counting them as a loss", () => {
    const record = seedReplayRecords().find((item) => item.claim.claimId === "sample-eth-pending")!;
    expect(evaluateReplay(record)).toMatchObject({
      status: "awaiting_data",
      missingObservations: [{ sessionDate: "2024-01-05" }],
    });
    expect(replayCounts([record]).not_met).toBe(0);
  });
  it("keeps a daily gold breach visible even when the endpoint is inside tolerance", () => {
    const record = seedReplayRecords().find((item) => item.claim.claimId === "sample-gold-miss")!;
    expect(evaluateReplay(record)).toMatchObject({
      status: "not_met",
      resolution: {
        check: {
          observations: [
            { value: 0, withinBounds: true },
            { value: 7, withinBounds: false },
            { value: 1, withinBounds: true },
            { value: 1.5, withinBounds: true },
          ],
        },
      },
    });
  });
  it("retains a future multi-year call as pending beyond fixture coverage", () => {
    const terms = initialReplayTerms();
    terms.horizon = { kind: "duration", value: 5, unit: "years" };
    const record = {
      ...createReplayRecord(terms, "A five-year view.", "replay-long", "2026-11-07T18:00:00Z"),
      resolvedAt: "2026-11-07T18:01:00Z",
    };
    expect(evaluateReplay(record)).toMatchObject({
      status: "active",
      window: { targetDate: "2029-01-02", endSessionDate: null },
    });
  });
  it.each(["public", "unknown-instrument", "unknown-dataset", "altered-fixture", "seed-id"])(
    "rejects incompatible stored replay metadata: %s",
    (change) => {
      const record = createReplayRecord(
        initialReplayTerms(),
        "A view.",
        "replay-test",
        "2026-11-07T18:00:00Z",
      );
      const tampered = structuredClone(record);
      if (change === "public") tampered.claim.visibility = "public";
      if (change === "unknown-instrument")
        tampered.claim.terms.instrument.id = "no-synthetic-series";
      if (change === "unknown-dataset" && tampered.claim.context.kind === "replay")
        tampered.claim.context.datasetId = "not-loaded";
      if (change === "altered-fixture") tampered.fixture = "incompatible_basis";
      if (change === "seed-id") tampered.claim.claimId = "sample-aapl-met";
      expect(replayRecordSchema.safeParse(tampered).success).toBe(false);
    },
  );
});
