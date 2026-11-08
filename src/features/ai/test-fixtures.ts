import { extractionSchema, type Extraction } from "./parser-contracts";

export function emptyExtraction(): Extraction {
  const fields = [
    "instrumentId",
    "kind",
    "benchmarkId",
    "horizon",
    "holdMeaning",
    "tolerance",
    "lower",
    "upper",
    "metric",
    "evaluation",
    "confidencePct",
    "rationale",
  ];
  return extractionSchema.parse({
    scope: "single",
    ...Object.fromEntries(fields.map((key) => [key, { value: null, quote: "" }])),
    assumptions: [],
    ambiguities: [],
  });
}
export const completeCall = "AAPL will outperform SPY over 30 calendar days. Confidence: 70%.";
export function comparisonExtraction(): Extraction {
  return {
    ...emptyExtraction(),
    instrumentId: { value: "us:nasdaq:aapl", quote: "AAPL" },
    kind: { value: "outperform", quote: "outperform" },
    benchmarkId: { value: "us:nyse arca:spy", quote: "SPY" },
    horizon: { value: { kind: "duration", value: 30, unit: "days" }, quote: "30 calendar days" },
    confidencePct: { value: 70, quote: "70%" },
  };
}
