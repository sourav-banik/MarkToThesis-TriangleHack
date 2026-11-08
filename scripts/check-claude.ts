import nextEnv from "@next/env";
import { extractWithClaude } from "../src/features/ai/claude";
import { normalizeExtraction } from "../src/features/ai/normalize";
import { parserRequestSchema } from "../src/features/ai/parser-contracts";

nextEnv.loadEnvConfig(process.cwd());
// Two short, synthetic calls to the real API. Never creates an account or claim.
try {
  for (const originalText of [
    "AAPL will outperform SPY over 30 calendar days. Confidence: 70%.",
    "Apple should outperform the market.",
  ]) {
    const input = parserRequestSchema.parse({ originalText });
    const now = new Date().toISOString();
    const { extraction, model } = await extractWithClaude(input, now);
    const result = normalizeExtraction(extraction, input, { id: crypto.randomUUID(), model, now });
    console.log(
      JSON.stringify({
        example: originalText,
        model,
        ready: result.ready,
        missingFields: result.draft.missingFields,
      }),
    );
    if (
      originalText.includes("30 calendar days")
        ? !result.ready
        : result.ready ||
          !result.draft.missingFields.includes("horizon") ||
          !result.draft.missingFields.includes("benchmark")
    )
      throw new Error("The real parser did not preserve the expected explicit/missing terms.");
  }
  console.log("Claude smoke check passed; no claims were saved.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Claude smoke check failed.");
  process.exitCode = 1;
}
