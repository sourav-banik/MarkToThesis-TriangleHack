import { describe, expect, it } from "vitest";
import { claimExamples, defaultTerms } from "../../demo/claims";
import { instruments } from "../market-data/catalog";
import {
  committedClaimVersionSchema,
  commitmentTermsSchema,
  confirmedTermsSchema,
  draftClaimSchema,
  isScorablePrediction,
} from "./contracts";

const example = claimExamples[0].terms;
const rangeExample = claimExamples.find((item) => item.id === "treasury-range")!.terms;
const version = {
  id: "v1",
  claimId: "claim1",
  authorId: "author1",
  version: 1,
  originalText: "Apple will outperform SPY.",
  terms: example,
  committedAt: "2026-11-07T17:00:00Z",
  publishedAt: "2026-11-07T17:00:00Z",
  visibility: "public",
  context: { kind: "live" },
  supersedesVersionId: null,
};

describe("claim terms", () => {
  it.each(claimExamples)(
    "validates the $id example without generating a timestamp",
    ({ terms }) => {
      expect(commitmentTermsSchema.safeParse(terms).success).toBe(true);
      expect(terms).not.toHaveProperty("committedAt");
    },
  );

  it.each(["outperform", "underperform"])("requires a distinct benchmark for %s", (kind) => {
    expect(
      confirmedTermsSchema.safeParse({
        ...example,
        prediction: { kind, benchmark: instruments.aapl, metric: "price_return" },
      }).success,
    ).toBe(false);
  });

  it("rejects comparing yield changes against stock returns", () => {
    expect(
      confirmedTermsSchema.safeParse({
        ...example,
        prediction: {
          kind: "outperform",
          benchmark: instruments.treasury5y,
          metric: "price_return",
        },
      }).success,
    ).toBe(false);
  });

  it("allows an explicit yield-change comparison without calling it a price return", () => {
    const prediction = {
      kind: "underperform",
      benchmark: instruments.treasury10y,
      metric: "yield_change_bps",
    };
    expect(confirmedTermsSchema.safeParse({ ...rangeExample, prediction }).success).toBe(true);
    expect(
      confirmedTermsSchema.safeParse({
        ...rangeExample,
        prediction: { ...prediction, metric: "price_return" },
      }).success,
    ).toBe(false);
  });

  it("accepts an explicitly identified stock beyond the starter catalog", () => {
    const instrument = {
      ...instruments.aapl,
      id: "us:nyse:ibm",
      symbol: "IBM",
      name: "IBM",
      venue: "NYSE",
      definition: "IBM common stock on NYSE.",
    };
    expect(confirmedTermsSchema.safeParse({ ...example, instrument }).success).toBe(true);
  });

  it("rejects silent cross-currency comparisons", () => {
    const benchmark = {
      ...instruments.spy,
      quote: { kind: "price", currency: "EUR", unit: "share" },
    };
    expect(
      confirmedTermsSchema.safeParse({
        ...example,
        prediction: { kind: "outperform", metric: "price_return", benchmark },
      }).success,
    ).toBe(false);
  });

  it("distinguishes scorable neutral hold from an unscored position", () => {
    expect(isScorablePrediction({ kind: "hold", meaning: { kind: "maintain_position" } })).toBe(
      false,
    );
    expect(
      isScorablePrediction({
        kind: "hold",
        meaning: {
          kind: "neutral",
          tolerance: 5,
          metric: "price_return_pct",
          evaluation: "at_review",
        },
      }),
    ).toBe(true);
  });

  it("requires an explicit positive neutral-hold tolerance", () => {
    expect(
      confirmedTermsSchema.safeParse({
        ...example,
        prediction: {
          kind: "hold",
          meaning: {
            kind: "neutral",
            tolerance: 0,
            metric: "price_return_pct",
            evaluation: "at_review",
          },
        },
      }).success,
    ).toBe(false);
  });

  it("uses basis points for yield tolerance, not percentage price return", () => {
    const prediction = {
      kind: "hold",
      meaning: {
        kind: "neutral",
        tolerance: 25,
        metric: "yield_change_bps",
        evaluation: "at_review",
      },
    };
    expect(confirmedTermsSchema.safeParse({ ...rangeExample, prediction }).success).toBe(true);
    expect(confirmedTermsSchema.safeParse({ ...example, prediction }).success).toBe(false);
  });

  it("requires range ordering and evaluation timing", () => {
    const prediction = {
      kind: "range",
      lower: 4.5,
      upper: 3.5,
      metric: "quoted_value",
      boundaries: "inclusive",
      evaluation: "at_review",
    };
    expect(confirmedTermsSchema.safeParse({ ...rangeExample, prediction }).success).toBe(false);
    expect(
      confirmedTermsSchema.safeParse({
        ...rangeExample,
        prediction: { ...prediction, lower: 3.5, upper: 4.5, evaluation: undefined },
      }).success,
    ).toBe(false);
  });

  it.each([
    { kind: "duration", value: 1, unit: "days" },
    { kind: "duration", value: 18, unit: "months" },
    { kind: "duration", value: 25, unit: "years" },
    { kind: "date", targetDate: "2031-05-31" },
  ])("supports flexible horizon $kind $value $unit", (horizon) => {
    expect(confirmedTermsSchema.safeParse({ ...example, horizon }).success).toBe(true);
  });

  it.each([0, -1, 1.5])("rejects invalid duration %s", (value) => {
    expect(
      confirmedTermsSchema.safeParse({
        ...example,
        horizon: { kind: "duration", value, unit: "days" },
      }).success,
    ).toBe(false);
  });

  it("does not manufacture a confidence value", () => {
    expect(
      confirmedTermsSchema.parse({ ...example, confidencePct: null }).confidencePct,
    ).toBeNull();
    expect(confirmedTermsSchema.safeParse({ ...example, confidencePct: 101 }).success).toBe(false);
  });

  it("reserves total return without enabling it for commitment", () => {
    const terms = {
      ...example,
      returnConvention: {
        kind: "total_return",
        dividends: "reinvested",
        splits: "adjusted",
        methodologyId: "future-method",
      },
    };
    expect(confirmedTermsSchema.safeParse(terms).success).toBe(true);
    expect(commitmentTermsSchema.safeParse(terms).success).toBe(false);
  });

  it("rejects non-finite numerical terms", () => {
    expect(
      confirmedTermsSchema.safeParse({
        ...rangeExample,
        prediction: {
          kind: "range",
          lower: 3,
          upper: Infinity,
          metric: "quoted_value",
          boundaries: "inclusive",
          evaluation: "at_review",
        },
      }).success,
    ).toBe(false);
  });

  it("allows clarification drafts while preventing incomplete confirmed terms", () => {
    const draft = {
      id: "draft",
      originalText: "Gold will do well.",
      proposedTerms: { instrument: instruments.gold },
      missingFields: ["prediction", "horizon"],
      clarificationQuestions: [
        { field: "prediction", question: "What measurable outcome do you expect?" },
      ],
    };
    expect(draftClaimSchema.safeParse(draft).success).toBe(true);
    expect(
      confirmedTermsSchema.safeParse({ ...defaultTerms, ...draft.proposedTerms }).success,
    ).toBe(false);
  });
});

describe("commitment and replay boundaries", () => {
  it("requires an actual logging timestamp independently of replay dates", () => {
    const replay = {
      ...version,
      context: {
        kind: "replay",
        simulatedCommitmentAt: "2024-01-01T17:00:00Z",
        datasetId: "licensed-replay-v1",
      },
    };
    expect(committedClaimVersionSchema.safeParse(replay).success).toBe(true);
    expect(
      committedClaimVersionSchema.safeParse({ ...replay, committedAt: undefined }).success,
    ).toBe(false);
  });

  it("rejects a replay dated after actual commitment", () => {
    expect(
      committedClaimVersionSchema.safeParse({
        ...version,
        context: {
          kind: "replay",
          simulatedCommitmentAt: "2027-01-01T00:00:00Z",
          datasetId: "replay",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects target dates that precede the relevant commitment", () => {
    expect(
      committedClaimVersionSchema.safeParse({
        ...version,
        terms: { ...example, horizon: { kind: "date", targetDate: "2025-01-01" } },
      }).success,
    ).toBe(false);
    expect(
      committedClaimVersionSchema.safeParse({
        ...version,
        terms: { ...example, horizon: { kind: "date", targetDate: "2025-01-01" } },
        context: {
          kind: "replay",
          simulatedCommitmentAt: "2024-01-01T00:00:00Z",
          datasetId: "replay",
        },
      }).success,
    ).toBe(true);
  });

  it("rejects publication before logging", () => {
    expect(
      committedClaimVersionSchema.safeParse({ ...version, publishedAt: "2026-01-01T00:00:00Z" })
        .success,
    ).toBe(false);
  });

  it("reports malformed timestamps and time zones as validation errors instead of throwing", () => {
    const terms = { ...example, horizon: { kind: "date", targetDate: "2030-01-01" } };
    expect(
      committedClaimVersionSchema.safeParse({ ...version, terms, committedAt: "invalid" }).success,
    ).toBe(false);
    expect(
      committedClaimVersionSchema.safeParse({
        ...version,
        terms: {
          ...terms,
          instrument: {
            ...instruments.aapl,
            observation: { ...instruments.aapl.observation, timeZone: "invalid" },
          },
        },
      }).success,
    ).toBe(false);
  });

  it("checks target dates in the instrument's calendar rather than slicing a UTC timestamp", () => {
    const nextDayTarget = { ...example, horizon: { kind: "date", targetDate: "2026-11-08" } };
    const atUtcMidnight = {
      ...version,
      committedAt: "2026-11-08T00:30:00Z",
      publishedAt: null,
      terms: nextDayTarget,
    };
    expect(committedClaimVersionSchema.safeParse(atUtcMidnight).success).toBe(true);
    expect(
      committedClaimVersionSchema.safeParse({
        ...atUtcMidnight,
        terms: {
          ...nextDayTarget,
          instrument: instruments.btc,
          prediction: {
            kind: "range",
            lower: 80000,
            upper: 120000,
            metric: "quoted_value",
            boundaries: "inclusive",
            evaluation: "at_review",
          },
        },
      }).success,
    ).toBe(false);
  });
});
