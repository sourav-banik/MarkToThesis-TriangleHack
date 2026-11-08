import { committedClaimVersionSchema, type ConfirmedTerms } from "../claims/contracts";
import { instrumentCatalog, instruments } from "../market-data/catalog";
import type { Instrument, PriceSnapshot } from "../market-data/contracts";
import { resolveClaim } from "../resolution/resolve";
import { syntheticSeries } from "../../demo/resolution";
import { defaultTerms } from "../../demo/claims";
import { z } from "zod";

export const REPLAY_DATASET_ID = "synthetic-ui-v1";
export const REPLAY_START = "2024-01-02T20:00:00Z";
export const REPLAY_AUTHOR = { id: "demo-author", displayName: "Alex Morgan", handle: "alex_demo" };
export const REPLAY_COVERAGE = "January 2–10, 2024";

// Entirely fabricated values, including instruments displayed with historical date labels.
const values: Record<string, number[]> = {
  [instruments.aapl.id]: [100, 104, 108, 110, 109, 112, 111],
  [instruments.msft.id]: [200, 202, 201, 204, 205, 203, 206],
  [instruments.nvda.id]: [100, 103, 108, 112, 111, 115, 114],
  [instruments.spy.id]: [100, 101, 102, 105, 104, 106, 105],
  [instruments.qqq.id]: [100, 101, 103, 104, 102, 105, 106],
  [instruments.gld.id]: [180, 181, 179, 182, 180, 183, 184],
  [instruments.treasury5y.id]: [4, 4.05, 4.1, 4.2, 4.15, 4.25, 4.2],
  [instruments.treasury10y.id]: [4, 4.02, 4.05, 4.1, 4.08, 4.12, 4.1],
  [instruments.gold.id]: [2000, 2140, 2020, 2030, 2040, 2010, 2020],
  [instruments.wti.id]: [75, 76, 74, 77, 78, 76, 79],
  [instruments.btc.id]: [40000, 41000, 42000, 43000, 44000, 45000, 43500, 44000, 44500],
  [instruments.eth.id]: [2000, 2020, 2040, 2060, 2080, 2100, 2070, 2080, 2090],
  [instruments.eurusd.id]: [1.1, 1.105, 1.102, 1.11, 1.108, 1.112, 1.115],
};

export const replayRecordSchema = z
  .object({
    claim: committedClaimVersionSchema,
    origin: z.enum(["preloaded", "browser"]),
    fixture: z.enum(["standard", "missing_end", "incompatible_basis"]),
    resolvedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .superRefine((record, context) => {
    const terms = record.claim.terms;
    const selected = [
      terms.instrument,
      ...(terms.prediction.kind === "outperform" || terms.prediction.kind === "underperform"
        ? [terms.prediction.benchmark]
        : []),
    ];
    if (
      selected.some(
        (instrument) =>
          !values[instrument.id] ||
          JSON.stringify(instrumentCatalog.find((candidate) => candidate.id === instrument.id)) !==
            JSON.stringify(instrument),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["claim", "terms"],
        message: "This replay requires an exact instrument from the fixed synthetic catalog.",
      });
    }
    if (!record.claim.claimId.startsWith(record.origin === "browser" ? "replay-" : "sample-")) {
      context.addIssue({
        code: "custom",
        path: ["claim", "claimId"],
        message: "Tab replays and preloaded examples use separate IDs.",
      });
    }
    if (
      record.claim.context.kind !== "replay" ||
      record.claim.context.datasetId !== REPLAY_DATASET_ID ||
      record.claim.context.simulatedCommitmentAt !== REPLAY_START
    ) {
      context.addIssue({
        code: "custom",
        path: ["claim", "context"],
        message: "Only this versioned synthetic replay dataset is supported.",
      });
    }
    if (
      record.claim.authorId !== REPLAY_AUTHOR.id ||
      record.claim.visibility !== "private" ||
      record.claim.publishedAt !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["claim"],
        message: "Replay records must remain private, unpublished demo-author records.",
      });
    }
    if (record.resolvedAt && Date.parse(record.resolvedAt) < Date.parse(record.claim.committedAt)) {
      context.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Replay calculation cannot precede confirmation.",
      });
    }
    if (record.origin === "browser" && record.fixture !== "standard") {
      context.addIssue({
        code: "custom",
        path: ["fixture"],
        message: "Browser-created replays cannot alter fixture data.",
      });
    }
  });
export type ReplayRecord = z.infer<typeof replayRecordSchema>;

export function initialReplayTerms(): ConfirmedTerms {
  return {
    ...defaultTerms,
    assumptions: [],
    instrument: instruments.aapl,
    prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
    horizon: { kind: "duration", value: 3, unit: "days" },
  };
}

export function createReplayRecord(
  terms: ConfirmedTerms,
  originalText: string,
  id: string,
  confirmedAt: string,
  origin: ReplayRecord["origin"] = "browser",
): ReplayRecord {
  return replayRecordSchema.parse({
    claim: {
      id: `${id}:v1`,
      claimId: id,
      authorId: REPLAY_AUTHOR.id,
      version: 1,
      originalText,
      terms,
      committedAt: confirmedAt,
      publishedAt: null,
      visibility: "private",
      context: {
        kind: "replay",
        simulatedCommitmentAt: REPLAY_START,
        datasetId: REPLAY_DATASET_ID,
      },
      supersedesVersionId: null,
    },
    origin,
    fixture: "standard",
    resolvedAt: null,
  });
}

function seriesFor(instrument: Instrument, terms: ConfirmedTerms) {
  const seriesValues = values[instrument.id];
  if (!seriesValues) throw new Error("This instrument has no prices in the synthetic dataset.");
  const series = syntheticSeries(instrument, seriesValues);
  if (
    terms.prediction.kind === "range" &&
    terms.prediction.metric === "quoted_value" &&
    instrument.quote.kind === "price"
  ) {
    series.observations.forEach((observation) => {
      observation.adjustment = "unadjusted";
    });
  }
  return series;
}

export function evaluateReplay(record: ReplayRecord) {
  if (!record.resolvedAt) return null;
  const header = {
    resolutionId: `${record.claim.claimId}:resolution-v1`,
    claim: record.claim,
    asOf: record.resolvedAt,
  };
  if (
    record.claim.terms.prediction.kind === "hold" &&
    record.claim.terms.prediction.meaning.kind === "maintain_position"
  )
    return resolveClaim(header);
  const terms = record.claim.terms;
  const asset = seriesFor(terms.instrument, terms);
  const benchmark =
    terms.prediction.kind === "outperform" || terms.prediction.kind === "underperform"
      ? seriesFor(terms.prediction.benchmark, terms)
      : null;
  if (record.fixture === "missing_end")
    asset.observations = asset.observations.filter(
      (snapshot) => snapshot.sessionDate !== "2024-01-05",
    );
  if (record.fixture === "incompatible_basis")
    (asset.observations[3] as PriceSnapshot).adjustmentBasisId =
      "deliberately-incompatible-synthetic-basis";
  return resolveClaim({ ...header, asset, benchmark });
}

export function seedReplayRecords(): ReplayRecord[] {
  const entries: {
    id: string;
    original: string;
    terms: ConfirmedTerms;
    fixture?: ReplayRecord["fixture"];
  }[] = [
    {
      id: "sample-aapl-met",
      original: "Apple will outperform SPY over three calendar days.",
      terms: initialReplayTerms(),
    },
    {
      id: "sample-nvda-miss",
      original: "NVIDIA will underperform QQQ over three calendar days.",
      terms: {
        ...initialReplayTerms(),
        instrument: instruments.nvda,
        prediction: { kind: "underperform", benchmark: instruments.qqq, metric: "price_return" },
      },
    },
    {
      id: "sample-treasury-met",
      original: "The 5-year Treasury yield will finish between 3.8% and 4.3%.",
      terms: {
        ...initialReplayTerms(),
        instrument: instruments.treasury5y,
        prediction: {
          kind: "range",
          lower: 3.8,
          upper: 4.3,
          metric: "quoted_value",
          boundaries: "inclusive",
          evaluation: "at_review",
        },
      },
    },
    {
      id: "sample-gold-miss",
      original: "Gold will stay within 5% of its starting price at every daily observation.",
      terms: {
        ...initialReplayTerms(),
        instrument: instruments.gold,
        prediction: {
          kind: "hold",
          meaning: {
            kind: "neutral",
            tolerance: 5,
            metric: "price_return_pct",
            evaluation: "every_daily_observation",
          },
        },
      },
    },
    {
      id: "sample-oil-unclear",
      original: "WTI will finish between $60 and $90 per barrel.",
      terms: {
        ...initialReplayTerms(),
        instrument: instruments.wti,
        prediction: {
          kind: "range",
          lower: 60,
          upper: 90,
          metric: "quoted_value",
          boundaries: "inclusive",
          evaluation: "at_review",
        },
      },
      fixture: "incompatible_basis",
    },
    {
      id: "sample-eth-pending",
      original: "Ether will finish between $1,900 and $2,200.",
      terms: {
        ...initialReplayTerms(),
        instrument: instruments.eth,
        prediction: {
          kind: "range",
          lower: 1900,
          upper: 2200,
          metric: "quoted_value",
          boundaries: "inclusive",
          evaluation: "at_review",
        },
      },
      fixture: "missing_end",
    },
    {
      id: "sample-bitcoin-hold",
      original: "I would keep my Bitcoin position for three days.",
      terms: {
        ...initialReplayTerms(),
        instrument: instruments.btc,
        prediction: { kind: "hold", meaning: { kind: "maintain_position" } },
      },
    },
  ];
  return entries.map((entry) =>
    replayRecordSchema.parse({
      ...createReplayRecord(
        entry.terms,
        entry.original,
        entry.id,
        "2026-11-07T14:00:00Z",
        "preloaded",
      ),
      origin: "preloaded",
      fixture: entry.fixture ?? "standard",
      resolvedAt: "2026-11-07T15:00:00Z",
    }),
  );
}
