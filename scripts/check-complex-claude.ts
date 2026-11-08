import nextEnv from "@next/env";
import { extractWithClaude } from "../src/features/ai/claude";
import { normalizeExtraction } from "../src/features/ai/normalize";
import { parserRequestSchema } from "../src/features/ai/parser-contracts";
import { complexParserCases } from "../src/features/ai/complex-cases";

nextEnv.loadEnvConfig(process.cwd());
let failures = 0;
for (const scenario of complexParserCases) {
  const now = new Date().toISOString();
  const input = parserRequestSchema.parse({ originalText: scenario.originalText });
  const { extraction, model } = await extractWithClaude(input, now);
  const result = normalizeExtraction(extraction, input, { id: crypto.randomUUID(), model, now });
  const terms = result.terms,
    prediction = terms?.prediction;
  const expected = scenario.expected;
  const matches =
    !!terms &&
    result.ready &&
    terms.instrument.symbol === expected.symbol &&
    prediction?.kind === expected.kind &&
    terms.confidencePct === expected.confidencePct &&
    terms.horizon.kind === "duration" &&
    terms.horizon.value === (expected.days ?? expected.months) &&
    terms.horizon.unit === (expected.days ? "days" : "months") &&
    (!expected.benchmark ||
      ((prediction.kind === "outperform" || prediction.kind === "underperform") &&
        prediction.benchmark.symbol === expected.benchmark)) &&
    (expected.lower === undefined ||
      (prediction.kind === "range" &&
        prediction.lower === expected.lower &&
        prediction.upper === expected.upper &&
        prediction.metric === "price_return_pct" &&
        prediction.evaluation === "at_review")) &&
    (expected.tolerance === undefined ||
      (prediction.kind === "hold" &&
        prediction.meaning.kind === "neutral" &&
        prediction.meaning.tolerance === expected.tolerance &&
        prediction.meaning.evaluation === "at_review"));
  console.log(
    JSON.stringify({
      scenario: scenario.name,
      model,
      passed: matches,
      ready: result.ready,
      missingFields: result.draft.missingFields,
      terms: terms ?? result.draft.proposedTerms,
    }),
  );
  if (!matches) failures++;
}
if (failures) {
  console.error(`${failures} complex parsing scenarios failed.`);
  process.exitCode = 1;
} else
  console.log(
    "All four complex calls parsed into the expected editable format. No claims were saved.",
  );
