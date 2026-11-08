import "server-only";
import { z } from "zod";
import { calendarDateAt } from "@/lib/dates";
import { HttpError } from "@/lib/server/http";
import type { PersistedClaim } from "@/features/claims/live-contracts";
import type { ConfirmedTerms } from "@/features/claims/contracts";
import { MassiveAdapter } from "./massive";
import { claimChartSchema } from "./chart-contracts";
import { liveBindingFor } from "./live-bindings";
import type { ObservationRequest, PriceSnapshot } from "./contracts";

// Cache only public market data, never claim text, identity, or visibility.
const chartPrices = new Map<string, { expires: number; data: Promise<PriceSnapshot[]> }>();
async function chartObservations(request: ObservationRequest) {
  const key = JSON.stringify([
    request.instrument.id,
    request.fromDate,
    request.throughDate,
    request.adjustment,
  ]);
  const existing = chartPrices.get(key);
  if (existing && existing.expires > Date.now()) return existing.data;
  for (const [id, value] of chartPrices) if (value.expires <= Date.now()) chartPrices.delete(id);
  if (chartPrices.size >= 64) chartPrices.delete(chartPrices.keys().next().value!);
  const data = new MassiveAdapter().getObservations(request).catch((error) => {
    chartPrices.delete(key);
    throw error;
  });
  chartPrices.set(key, { expires: Date.now() + 60000, data });
  return data;
}

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
function provider(binding: unknown) {
  return z.object({ provider: z.string(), seriesId: z.string() }).safeParse(binding).data;
}

export async function getPredictionChart(
  terms: ConfirmedTerms,
  committedAt: string | null,
  asOf = new Date().toISOString(),
) {
  const instrument = terms.instrument;
  const prediction = terms.prediction;
  const benchmark =
    prediction.kind === "outperform" || prediction.kind === "underperform"
      ? prediction.benchmark
      : null;
  for (const asset of [instrument, ...(benchmark ? [benchmark] : [])]) {
    if (liveBindingFor(asset)?.provider !== "massive")
      throw new HttpError(422, "Price-chart previews support AAPL, MSFT, NVDA, SPY, QQQ, and GLD.");
  }
  const throughDate = calendarDateAt(asOf, instrument.observation.timeZone)!;
  const commitmentDate = committedAt
    ? calendarDateAt(committedAt, instrument.observation.timeZone)!
    : throughDate;
  // Show context even when the author has only just published the call.
  const fromDate = [
    shiftDate(throughDate, -365),
    [shiftDate(commitmentDate, -14), shiftDate(throughDate, -90)].sort()[0],
  ].sort()[1];
  const adjustment =
    prediction.kind === "range" && prediction.metric === "quoted_value"
      ? "unadjusted"
      : "split_adjusted";
  try {
    const asset = await chartObservations({ instrument, fromDate, throughDate, adjustment });
    const benchmarkSnapshots = benchmark
      ? await chartObservations({
          instrument: benchmark,
          fromDate,
          throughDate,
          adjustment: "split_adjusted",
        })
      : null;
    return claimChartSchema.parse({
      asset: {
        symbol: instrument.symbol,
        points: asset.map((item) => ({ date: item.sessionDate, value: item.value })),
      },
      benchmark:
        benchmark && benchmarkSnapshots
          ? {
              symbol: benchmark.symbol,
              points: benchmarkSnapshots.map((item) => ({
                date: item.sessionDate,
                value: item.value,
              })),
            }
          : null,
      fromDate,
      throughDate,
      asOf: new Date().toISOString(),
      committedAt,
      terms,
      adjustment:
        adjustment === "unadjusted"
          ? "unadjusted_quoted_price"
          : "split_adjusted_price_return_excluding_dividends",
    });
  } catch {
    throw new HttpError(
      503,
      "Daily price data could not be loaded. Your prediction can still be reviewed and published; retry the chart shortly.",
    );
  }
}

export async function getClaimChart(claim: PersistedClaim, asOf = new Date().toISOString()) {
  const terms = claim.version.terms;
  const prediction = terms.prediction;
  const asset = provider(claim.marketBindings.asset);
  const benchmark = provider(claim.marketBindings.benchmark);
  if (
    asset?.provider !== "massive" ||
    asset.seriesId !== terms.instrument.symbol ||
    ((prediction.kind === "outperform" || prediction.kind === "underperform") &&
      (benchmark?.provider !== "massive" || benchmark.seriesId !== prediction.benchmark.symbol))
  )
    throw new HttpError(
      422,
      "This saved claim is not bound to the supported Massive price series.",
    );
  return getPredictionChart(terms, claim.version.committedAt, asOf);
}
