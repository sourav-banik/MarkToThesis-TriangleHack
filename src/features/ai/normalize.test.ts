import { describe, expect, it } from "vitest";
import { normalizeExtraction } from "./normalize";
import { parserRequestSchema, extractionJsonSchema } from "./parser-contracts";
import { completeCall, comparisonExtraction, emptyExtraction } from "./test-fixtures";
import { instruments } from "@/features/market-data/catalog";

const metadata = { id: "proposal-test", model: "fixture-model", now: "2026-11-07T20:00:00Z" };
describe("claim proposal normalization", () => {
  it("requires a choice for multiple or conditional calls even when one extracted forecast is complete", () => {
    for (const scope of ["multiple", "conditional"] as const) {
      const result = normalizeExtraction(
        { ...comparisonExtraction(), scope },
        parserRequestSchema.parse({ originalText: completeCall }),
        metadata,
      );
      expect(result.ready).toBe(false);
      expect(result.draft.missingFields).toContain("ambiguity");
    }
  });
  it("requires missing terms and never fills a default horizon or benchmark", () => {
    const input = parserRequestSchema.parse({
      originalText: "Apple might do better than the market.",
    });
    const raw = {
      ...emptyExtraction(),
      instrumentId: { value: instruments.aapl.id, quote: "Apple" },
      kind: { value: "outperform" as const, quote: "do better" },
    };
    const result = normalizeExtraction(raw, input, metadata);
    expect(result.ready).toBe(false);
    expect(result.terms).toBeNull();
    expect(result.draft.missingFields).toContain("horizon");
    expect(result.draft.missingFields).toContain("benchmark");
    expect(result.draft.proposedTerms).not.toHaveProperty("horizon");
    expect(result.draft.proposedTerms.confidencePct).toBeNull();
  });
  it("accepts an explicit grounded comparison and derives conventions without a score", () => {
    const result = normalizeExtraction(
      comparisonExtraction(),
      parserRequestSchema.parse({ originalText: completeCall }),
      metadata,
    );
    expect(result.ready).toBe(true);
    expect(result.terms?.instrument).toEqual(instruments.aapl);
    expect(result.terms?.prediction.kind).toBe("outperform");
    expect(result.terms?.confidencePct).toBe(70);
    expect(result.terms?.returnConvention.kind).toBe("price_return");
    expect(result).not.toHaveProperty("outcome");
    expect(result.draft.originalText).toBe(completeCall);
  });
  it("uses author answers as evidence but never uses a question to prove its own answer", () => {
    const originalText = "AAPL will outperform the market.";
    const raw = comparisonExtraction();
    raw.horizon.quote = "30 calendar days";
    const input = parserRequestSchema.parse({
      originalText,
      clarifications: [
        {
          field: "benchmark",
          question: "Use SPY for 30 calendar days?",
          answer: "I have not chosen.",
        },
      ],
    });
    const missing = normalizeExtraction(raw, input, metadata);
    expect(missing.ready).toBe(false);
    expect(missing.draft.missingFields).toContain("benchmark");
    input.clarifications[0].answer = "SPY over 30 calendar days. Confidence: 70%.";
    expect(normalizeExtraction(raw, input, metadata).ready).toBe(true);
  });
  it("rejects a catalog ID whose source quote names a different asset", () => {
    const raw = comparisonExtraction();
    raw.instrumentId.value = instruments.nvda.id;
    const result = normalizeExtraction(
      raw,
      parserRequestSchema.parse({ originalText: completeCall }),
      metadata,
    );
    expect(result.draft.missingFields).toContain("instrument");
    expect(result.terms).toBeNull();
  });
  it("does not interpret a vague market reference as SPY or spot gold as GLD", () => {
    const raw = comparisonExtraction();
    raw.instrumentId = { value: instruments.gld.id, quote: "gold" };
    raw.benchmarkId.quote = "stocks";
    const result = normalizeExtraction(
      raw,
      parserRequestSchema.parse({
        originalText: "gold will outperform stocks over 30 calendar days",
      }),
      metadata,
    );
    expect(result.draft.missingFields).toEqual(expect.arrayContaining(["instrument", "benchmark"]));
  });
  it("asks which hold meaning is intended; explicit position holds remain unscored proposals", () => {
    const raw = { ...comparisonExtraction(), kind: { value: "hold" as const, quote: "hold" } };
    const input = parserRequestSchema.parse({ originalText: "hold AAPL for 30 calendar days" });
    expect(normalizeExtraction(raw, input, metadata).draft.missingFields).toContain("hold_meaning");
    raw.holdMeaning = { value: "maintain_position", quote: "keep my position" };
    input.clarifications.push({
      field: "hold_meaning",
      question: "Which meaning?",
      answer: "keep my position",
    });
    const ready = normalizeExtraction(raw, input, metadata);
    expect(ready.ready).toBe(true);
    expect(ready.terms?.prediction).toEqual({
      kind: "hold",
      meaning: { kind: "maintain_position" },
    });
  });
  it("requires range units and evaluation; reversed bounds ask a question instead of failing the draft schema", () => {
    const raw = {
      ...comparisonExtraction(),
      kind: { value: "range" as const, quote: "between" },
      lower: { value: 200, quote: "200" },
      upper: { value: 100, quote: "100" },
    };
    const input = parserRequestSchema.parse({
      originalText: "AAPL between 200 and 100 at review over 30 calendar days",
    });
    expect(normalizeExtraction(raw, input, metadata).draft.missingFields).toEqual(
      expect.arrayContaining(["metric", "evaluation"]),
    );
    raw.metric = { value: "quoted_value", quote: "between 200 and 100" };
    raw.evaluation = { value: "at_review", quote: "at review" };
    const result = normalizeExtraction(raw, input, metadata);
    expect(result.terms).toBeNull();
    expect(result.draft.missingFields).toContain("range_bounds");
  });
  it("preserves yield range units and refuses equity/yield comparison", () => {
    const raw = {
      ...comparisonExtraction(),
      instrumentId: { value: instruments.treasury5y.id, quote: "US5Y" },
      kind: { value: "range" as const, quote: "between" },
      lower: { value: 3.5, quote: "3.5%" },
      upper: { value: 4.5, quote: "4.5%" },
      metric: { value: "quoted_value" as const, quote: "3.5% and 4.5%" },
      evaluation: { value: "at_review" as const, quote: "at review" },
    };
    const input = parserRequestSchema.parse({
      originalText: "US5Y between 3.5% and 4.5% at review over 30 calendar days",
    });
    const yieldResult = normalizeExtraction(raw, input, metadata);
    expect(yieldResult.ready).toBe(false);
    expect(yieldResult.draft.missingFields).toContain("instrument_reference");
    const incompatible = normalizeExtraction(
      { ...raw, kind: { value: "outperform", quote: "outperform" } },
      parserRequestSchema.parse({ originalText: "US5Y outperform SPY over 30 calendar days" }),
      metadata,
    );
    expect(incompatible.ready).toBe(false);
    expect(incompatible.draft.missingFields).toContain("ambiguity");
  });
  it("blocks unsupported live bindings and past dates", () => {
    const raw = comparisonExtraction();
    raw.instrumentId = { value: instruments.btc.id, quote: "Bitcoin" };
    raw.horizon = { value: { kind: "date", targetDate: "2024-01-01" }, quote: "2024-01-01" };
    const result = normalizeExtraction(
      raw,
      parserRequestSchema.parse({ originalText: "Bitcoin outperform SPY by 2024-01-01" }),
      metadata,
    );
    expect(result.draft.missingFields).toEqual(
      expect.arrayContaining(["instrument_reference", "horizon"]),
    );
  });
  it("requires an explicit dividend-exclusion clarification when total return was requested", () => {
    const input = parserRequestSchema.parse({ originalText: completeCall + " Use total return." });
    expect(
      normalizeExtraction(comparisonExtraction(), input, metadata).draft.missingFields,
    ).toContain("return_convention");
    input.clarifications.push({
      field: "return_convention",
      question: "Price return instead?",
      answer: "Use price return excluding dividends.",
    });
    expect(normalizeExtraction(comparisonExtraction(), input, metadata).ready).toBe(true);
  });
  it("never imports model-generated reasoning or assumptions as author text", () => {
    const raw = comparisonExtraction();
    raw.rationale = { value: "Invented strong earnings rationale", quote: "AAPL" };
    raw.assumptions = [
      { statement: "Invented demand", falsificationCondition: "Invented evidence", quote: "AAPL" },
    ];
    const result = normalizeExtraction(
      raw,
      parserRequestSchema.parse({ originalText: completeCall }),
      metadata,
    );
    expect(result.terms?.rationale).toBe("");
    expect(result.terms?.assumptions).toEqual([]);
    expect(result.warnings).not.toHaveLength(0);
  });
  it("keeps the provider schema inside Claude's union limit without dropping runtime constraints", () => {
    const schema = extractionJsonSchema();
    let unions = 0;
    function visit(value: unknown) {
      if (value && typeof value === "object") {
        if ("anyOf" in value || ("type" in value && Array.isArray(value.type))) unions++;
        expect(value).not.toHaveProperty("oneOf");
        Object.values(value).forEach(visit);
      }
    }
    visit(schema);
    expect(unions).toBeLessThanOrEqual(16);
  });
});
