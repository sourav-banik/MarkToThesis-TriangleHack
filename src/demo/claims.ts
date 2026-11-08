import { confirmedTermsSchema, type ConfirmedTerms } from "../features/claims/contracts";
import { instruments } from "../features/market-data/catalog";
import { standardClaimFields as defaultTerms } from "../features/claims/conventions";
export { defaultTerms };

export type ClaimExample = {
  id: string;
  originalText: string;
  category: string;
  terms: ConfirmedTerms;
};

export const claimExamples: ClaimExample[] = [
  {
    id: "apple-outperform",
    category: "Relative performance",
    originalText: "Apple will outperform the S&P 500 over the next 3 months.",
    terms: confirmedTermsSchema.parse({
      ...defaultTerms,
      instrument: instruments.aapl,
      prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
      horizon: { kind: "duration", value: 3, unit: "months" },
      confidencePct: 70,
      rationale:
        "Services growth could support earnings. This is an illustrative hypothesis, not an investment recommendation.",
      assumptions: [
        {
          id: "services",
          statement: "Services revenue growth remains resilient.",
          falsificationCondition:
            "Reported services growth materially slows during the measurement period.",
        },
      ],
    }),
  },
  {
    id: "bitcoin-range",
    category: "Price range",
    originalText: "Bitcoin will finish the next year between $80,000 and $120,000.",
    terms: confirmedTermsSchema.parse({
      ...defaultTerms,
      instrument: instruments.btc,
      prediction: {
        kind: "range",
        lower: 80000,
        upper: 120000,
        metric: "quoted_value",
        boundaries: "inclusive",
        evaluation: "at_review",
      },
      horizon: { kind: "duration", value: 1, unit: "years" },
    }),
  },
  {
    id: "treasury-range",
    category: "Yield range",
    originalText: "The 5-year Treasury yield will be between 3.5% and 4.5% in two years.",
    terms: confirmedTermsSchema.parse({
      ...defaultTerms,
      instrument: instruments.treasury5y,
      prediction: {
        kind: "range",
        lower: 3.5,
        upper: 4.5,
        metric: "quoted_value",
        boundaries: "inclusive",
        evaluation: "at_review",
      },
      horizon: { kind: "duration", value: 2, unit: "years" },
    }),
  },
  {
    id: "gold-hold",
    category: "Neutral forecast",
    originalText: "Gold will stay within 5% of its starting price over the next month.",
    terms: confirmedTermsSchema.parse({
      ...defaultTerms,
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
      horizon: { kind: "duration", value: 1, unit: "months" },
    }),
  },
  {
    id: "nvidia-underperform",
    category: "Relative performance",
    originalText: "NVIDIA will underperform QQQ over the next 30 days.",
    terms: confirmedTermsSchema.parse({
      ...defaultTerms,
      instrument: instruments.nvda,
      prediction: { kind: "underperform", benchmark: instruments.qqq, metric: "price_return" },
      horizon: { kind: "duration", value: 30, unit: "days" },
    }),
  },
  {
    id: "bitcoin-position",
    category: "Position statement",
    originalText: "I plan to keep my Bitcoin position for the next three years.",
    terms: confirmedTermsSchema.parse({
      ...defaultTerms,
      instrument: instruments.btc,
      prediction: { kind: "hold", meaning: { kind: "maintain_position" } },
      horizon: { kind: "duration", value: 3, unit: "years" },
    }),
  },
];
