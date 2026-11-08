import {
  commitmentTermsSchema,
  predictionSchema,
  type ConfirmedTerms,
  type DraftClaim,
} from "@/features/claims/contracts";
import { instrumentCatalog } from "@/features/market-data/catalog";
import { liveBindingFor } from "@/features/market-data/live-bindings";
import { calendarDateAt } from "@/lib/dates";
import { standardClaimFields as defaultTerms } from "@/features/claims/conventions";
import { parserResponseSchema, type Extraction, type ParserRequest } from "./parser-contracts";

export const PARSER_PROMPT_VERSION = "claim-extraction-v1";
export function normalizeExtraction(
  raw: Extraction,
  input: ParserRequest,
  metadata: { id: string; model: string; now: string },
) {
  const sources = [
    input.originalText,
    input.rationale,
    ...input.clarifications.map((item) => item.answer),
  ];
  const grounded = (quote: string | null) =>
    quote !== null && quote.trim().length > 0 && sources.some((source) => source.includes(quote));
  function value<K extends Exclude<keyof Extraction, "assumptions" | "ambiguities">>(
    field: K,
  ): Extraction[K]["value"] {
    return grounded(raw[field].quote) ? raw[field].value : null;
  }
  const questions: DraftClaim["clarificationQuestions"] = [];
  const warnings: string[] = [];
  function ask(field: DraftClaim["missingFields"][number], question: string) {
    if (!questions.some((item) => item.field === field)) questions.push({ field, question });
  }
  function instrumentFrom(field: "instrumentId" | "benchmarkId") {
    const asset = instrumentCatalog.find((item) => item.id === value(field));
    if (!asset) return undefined;
    const normalize = (text: string) =>
      ` ${text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()} `;
    const aliases = [asset.symbol, asset.name];
    if (asset.id === "commodity:gold:spot:usd") aliases.push("gold");
    if (asset.quote.kind === "yield")
      aliases.push(
        `${asset.quote.tenorYears} year treasury yield`,
        `${asset.quote.tenorYears} yr treasury yield`,
        `${asset.quote.tenorYears}y treasury`,
      );
    const quote = normalize(raw[field].quote ?? "");
    return aliases.some((alias) => quote.includes(normalize(alias))) ? asset : undefined;
  }
  const instrument = instrumentFrom("instrumentId");
  const benchmark = instrumentFrom("benchmarkId");
  const kind = value("kind"),
    horizon = value("horizon");
  const isYield = instrument?.quote.kind === "yield";
  let prediction: ConfirmedTerms["prediction"] | undefined;
  if (!instrument)
    ask(
      "instrument",
      "Which exact instrument and listing or reference series do you mean? Select a supported symbol, for example AAPL, SPY, GLD, US5Y, or WTI.",
    );
  if (!kind)
    ask("prediction", "Is this an outperform, underperform, hold, or inclusive range claim?");
  if (!horizon)
    ask(
      "horizon",
      "What is the review horizon? Give a number of calendar days, months, or years, or an exact future date.",
    );
  if (kind === "outperform" || kind === "underperform") {
    if (!benchmark)
      ask(
        "benchmark",
        "Which exact benchmark should this instrument be compared with? A reference to ‘the market’ or ‘stocks’ needs a specific instrument.",
      );
    if (instrument && benchmark)
      prediction = { kind, benchmark, metric: isYield ? "yield_change_bps" : "price_return" };
  }
  if (kind === "hold") {
    const meaning = value("holdMeaning");
    if (!meaning)
      ask(
        "hold_meaning",
        "Does hold mean keep your position (unscored), or stay within a measurable tolerance?",
      );
    if (meaning === "maintain_position")
      prediction = { kind, meaning: { kind: "maintain_position" } };
    if (meaning === "neutral") {
      const tolerance = value("tolerance"),
        evaluation = value("evaluation"),
        metric = value("metric");
      if (tolerance === null)
        ask(
          "tolerance",
          "What positive tolerance should apply, in percent price change or basis points of yield change?",
        );
      if (!evaluation)
        ask(
          "evaluation",
          "Must the condition hold at the review observation, or at every daily observation?",
        );
      if (!metric || metric === "quoted_value")
        ask(
          "metric",
          "Is this tolerance a percent price change or a yield change in basis points?",
        );
      if (tolerance !== null && evaluation && metric && metric !== "quoted_value")
        prediction = { kind, meaning: { kind: "neutral", tolerance, evaluation, metric } };
    }
  }
  if (kind === "range") {
    const lower = value("lower"),
      upper = value("upper"),
      metric = value("metric"),
      evaluation = value("evaluation");
    if (lower === null || upper === null)
      ask("range_bounds", "What are the inclusive lower and upper bounds?");
    if (!metric)
      ask(
        "metric",
        "Are those bounds quoted prices/yield levels, percent price returns, or yield changes in basis points?",
      );
    if (!evaluation)
      ask("evaluation", "Should the range hold at review, or at every daily observation?");
    if (lower !== null && upper !== null && metric && evaluation)
      prediction = { kind, lower, upper, metric, evaluation, boundaries: "inclusive" };
  }
  if (prediction) {
    const checked = predictionSchema.safeParse(prediction);
    if (!checked.success) {
      ask(
        kind === "range" ? "range_bounds" : "prediction",
        "The proposed condition is invalid. Please supply ordered range bounds or correct the prediction terms.",
      );
      prediction = undefined;
    }
  }
  const confidenceCandidate = value("confidencePct");
  const confidenceNumbers = (
    raw.confidencePct.quote.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g) ?? []
  ).map(Number);
  const confidence =
    confidenceCandidate !== null &&
    confidenceNumbers.some(
      (number) =>
        number === confidenceCandidate ||
        (!raw.confidencePct.quote.includes("%") &&
          number >= 0 &&
          number <= 1 &&
          number * 100 === confidenceCandidate),
    )
      ? confidenceCandidate
      : null;
  const extractedRationale = value("rationale");
  const rationale =
    input.rationale.trim() ||
    (extractedRationale && sources.some((source) => source.includes(extractedRationale))
      ? extractedRationale
      : "");
  const assumptions = raw.assumptions
    .filter(
      (item) =>
        grounded(item.quote) &&
        sources.some((source) => source.includes(item.statement)) &&
        sources.some((source) => source.includes(item.falsificationCondition)),
    )
    .map((item, index) => ({
      id: `stated-${index + 1}`,
      statement: item.statement,
      falsificationCondition: item.falsificationCondition,
    }));
  if (raw.assumptions.length !== assumptions.length)
    warnings.push("Unverifiable AI assumptions were omitted; add your own reasoning in the form.");
  const proposedTerms: DraftClaim["proposedTerms"] = {
    ...(instrument ? { instrument } : {}),
    ...(prediction ? { prediction } : {}),
    ...(horizon ? { horizon } : {}),
    confidencePct: confidence,
    rationale,
    assumptions,
  };
  let terms: ConfirmedTerms | null = null;
  if (instrument && prediction && horizon) {
    const parsed = commitmentTermsSchema.safeParse({ ...defaultTerms, ...proposedTerms });
    if (parsed.success) terms = parsed.data;
    else
      for (const issue of parsed.error.issues)
        ask("ambiguity", issue.message + " Please correct these terms.");
  }
  if (instrument && horizon?.kind === "date") {
    const today = calendarDateAt(metadata.now, instrument.observation.timeZone);
    if (today && horizon.targetDate <= today)
      ask(
        "horizon",
        "Choose an exact target date after today. Live calls cannot be backdated for historical performance.",
      );
  }
  const positionOnly =
    prediction?.kind === "hold" && prediction.meaning.kind === "maintain_position";
  for (const asset of [
    instrument,
    ...(benchmark && (kind === "outperform" || kind === "underperform") ? [benchmark] : []),
  ]) {
    if (asset && !positionOnly && !liveBindingFor(asset))
      ask(
        "instrument_reference",
        `${asset.symbol} has no fixed live source yet. Choose a supported live series explicitly, or use manual synthetic replay. An ETF is not a silent substitute for spot prices.`,
      );
  }
  for (const ambiguity of raw.ambiguities) {
    // Ordinary comparisons already have a fixed endpoint rule; there is no missing
    // range-sampling choice. An explicitly requested alternative still needs review.
    if (
      (kind === "outperform" || kind === "underperform") &&
      ambiguity.field === "evaluation" &&
      value("evaluation") === null
    )
      continue;
    ask(ambiguity.field, ambiguity.question);
  }
  const latestConvention = [...input.clarifications]
    .reverse()
    .find((item) => item.field === "return_convention");
  if (
    /total[ -]return|includ(?:e|ing) dividends|reinvest(?:ed|ing)? dividends/i.test(
      input.originalText,
    ) &&
    !/exclud(?:e|ed|ing) dividends|price[ -]return/i.test(latestConvention?.answer ?? "")
  )
    ask(
      "return_convention",
      "This implementation excludes dividends. Do you explicitly want a price-return claim excluding dividends instead of total return?",
    );
  if (!terms && questions.length === 0)
    ask("prediction", "Please clarify the measurable condition before continuing.");
  if (questions.length) terms = null;
  return parserResponseSchema.parse({
    draft: {
      id: metadata.id,
      originalText: input.originalText,
      proposedTerms,
      missingFields: questions.map((item) => item.field),
      clarificationQuestions: questions,
    },
    terms,
    ready: terms !== null,
    provider: "anthropic",
    model: metadata.model,
    promptVersion: PARSER_PROMPT_VERSION,
    warnings,
  });
}
