import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const observations = vi.hoisted(() => vi.fn(async () => []));
vi.mock("./massive", () => ({
  MassiveAdapter: class {
    getObservations = observations;
  },
}));
import { getPredictionChart } from "./claim-chart";
import { standardClaimFields } from "@/features/claims/conventions";
import { instruments } from "./catalog";
import type { ConfirmedTerms } from "@/features/claims/contracts";

describe("chart market-data service", () => {
  it("loads context before a newly published claim rather than showing an empty same-day window", async () => {
    const terms: ConfirmedTerms = {
      ...standardClaimFields,
      assumptions: [],
      instrument: instruments.aapl,
      prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
      horizon: { kind: "duration", value: 30, unit: "days" },
    };
    const chart = await getPredictionChart(terms, "2026-11-08T14:00:00Z", "2026-11-08T15:00:00Z");
    expect(chart.fromDate).toBe("2026-08-10");
    expect(chart.committedAt).toBe("2026-11-08T14:00:00Z");
    expect(chart.terms.prediction.kind).toBe("outperform");
    expect(observations).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: "split_adjusted" }),
    );
  });
  it("uses unadjusted prices for literal quoted-price targets", async () => {
    const terms: ConfirmedTerms = {
      ...standardClaimFields,
      assumptions: [],
      instrument: instruments.nvda,
      prediction: {
        kind: "range",
        lower: 100,
        upper: 150,
        metric: "quoted_value",
        boundaries: "inclusive",
        evaluation: "at_review",
      },
      horizon: { kind: "duration", value: 30, unit: "days" },
    };
    const chart = await getPredictionChart(terms, null, "2026-11-08T15:00:00Z");
    expect(chart.adjustment).toBe("unadjusted_quoted_price");
    expect(observations).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: "unadjusted" }),
    );
  });
});
