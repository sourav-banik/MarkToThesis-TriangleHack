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
    "I considered MSFT but my call is AAPL: despite short-term volatility, I expect AAPL to outperform SPY over three calendar months. Confidence: 70%. My reasoning is resilient services demand; if margins contract, I will revisit the thesis.",
    "AAPL will outperform SPY over 30 calendar days and NVDA will outperform QQQ over 90 calendar days. Confidence: 70%.",
    "Only if the Fed cuts rates next month, start a 30 calendar day AAPL outperform SPY claim. Confidence: 70%.",
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
    const complicated = originalText.includes("and NVDA") || originalText.startsWith("Only if");
    const vague = originalText === "Apple should outperform the market.";
    if (
      complicated
        ? result.ready || !result.draft.missingFields.includes("ambiguity")
        : vague
          ? result.ready ||
            !result.draft.missingFields.includes("horizon") ||
            !result.draft.missingFields.includes("benchmark")
          : !result.ready
    )
      throw new Error("The real parser did not preserve the expected explicit/missing terms.");
  }
  console.log("Claude smoke check passed; no claims were saved.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Claude smoke check failed.");
  process.exitCode = 1;
}
