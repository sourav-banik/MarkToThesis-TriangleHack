import type { ConfirmedTerms } from "@/features/claims/contracts";

export type ComplexParserCase = {
  name: string;
  originalText: string;
  expected: {
    symbol: string;
    kind: ConfirmedTerms["prediction"]["kind"];
    benchmark?: string;
    days?: number;
    months?: number;
    confidencePct: number | null;
    lower?: number;
    upper?: number;
    tolerance?: number;
  };
};
export const complexParserCases: ComplexParserCase[] = [
  {
    name: "comparison with distracting assets and an invalidation condition",
    originalText:
      "I have looked at Microsoft and NVIDIA, but the one call I want recorded is Apple (AAPL) doing better than the SPDR S&P 500 ETF, SPY, over the next three calendar months. The reasoning is that services demand should cushion weaker hardware sales. If services growth materially weakens, I would reconsider the thesis. My confidence is seven out of ten. Evaluate price performance excluding dividends, with normal split adjustments.",
    expected: {
      symbol: "AAPL",
      kind: "outperform",
      benchmark: "SPY",
      months: 3,
      confidencePct: 70,
    },
  },
  {
    name: "outperformance during a possible selloff",
    originalText:
      "I'm not predicting that technology as a whole goes up. Even if the sector sells off, I expect Microsoft (MSFT) to lose less than Invesco QQQ over the next ninety calendar days. This is a relative price-performance call excluding dividends, not an absolute positive-return target. I put the confidence at seventy-five percent. The reasoning is that recurring enterprise revenue could cushion the downside; I would reconsider if enterprise renewals deteriorate.",
    expected: { symbol: "MSFT", kind: "outperform", benchmark: "QQQ", days: 90, confidencePct: 75 },
  },
  {
    name: "asymmetric endpoint return range",
    originalText:
      "There could be a lot of intraday volatility in NVIDIA, so don't interpret this as a price target or a path constraint. My actual claim is that NVDA's price return, excluding dividends and adjusted for splits, will be no worse than minus eight percent and no better than plus twelve percent at the review close thirty calendar days after its starting close. Both bounds are inclusive. Confidence: 0.7. Intermediate moves outside that band do not invalidate this endpoint claim.",
    expected: { symbol: "NVDA", kind: "range", days: 30, confidencePct: 70, lower: -8, upper: 12 },
  },
  {
    name: "neutral hold rather than a position statement",
    originalText:
      "For SPY I mean neutral, not that I own it or intend to keep a position. After forty-five calendar days I expect its closing price return to finish within three percent either way of the starting close. Check only the ending close, not every day or intraday. Dividends are excluded and splits are adjusted. My confidence is 7/10. The reasoning is that weaker growth and easier financial conditions could offset each other.",
    expected: { symbol: "SPY", kind: "hold", days: 45, confidencePct: 70, tolerance: 3 },
  },
];
