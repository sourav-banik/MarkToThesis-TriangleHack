import "server-only";
import { z } from "zod";
import { calendarDateAt } from "@/lib/dates";
import { HttpError } from "@/lib/server/http";
import type { PersistedClaim } from "@/features/claims/live-contracts";
import { MassiveAdapter } from "./massive";
import { claimChartSchema } from "./chart-contracts";

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function provider(binding: unknown) {
  return z.object({ provider: z.string() }).safeParse(binding).data?.provider ?? null;
}

export async function getClaimChart(claim: PersistedClaim, asOf = new Date().toISOString()) {
  const instrument = claim.version.terms.instrument;
  if (instrument.assetClass !== "stock" && instrument.assetClass !== "etf")
    throw new HttpError(422, "A Massive price chart is currently available for U.S. stocks and ETFs only.");
  if (provider(claim.marketBindings.asset) !== "massive")
    throw new HttpError(422, "This claim was committed before the Massive market-data binding.");
  const throughDate = calendarDateAt(asOf, instrument.observation.timeZone);
  const commitmentDate = calendarDateAt(claim.version.committedAt, instrument.observation.timeZone);
  if (!throughDate || !commitmentDate) throw new HttpError(503, "The chart window could not be calculated.");
  // Keep demo pages quick and within ordinary daily-bar plan limits.
  const fromDate = [commitmentDate, shiftDate(throughDate, -365)].sort().at(-1)!;
  const adapter = new MassiveAdapter();
  try {
    const asset = await adapter.getObservations({ instrument, fromDate, throughDate, adjustment: "split_adjusted" });
    const prediction = claim.version.terms.prediction;
    const benchmark = prediction.kind === "outperform" || prediction.kind === "underperform" ? prediction.benchmark : null;
    if (benchmark && provider(claim.marketBindings.benchmark) !== "massive")
      throw new HttpError(422, "This benchmark was committed before the Massive market-data binding.");
    const benchmarkSnapshots = benchmark
      ? await adapter.getObservations({ instrument: benchmark, fromDate, throughDate, adjustment: "split_adjusted" })
      : null;
    return claimChartSchema.parse({
      asset: { symbol: instrument.symbol, points: asset.map((item) => ({ date: item.sessionDate, value: item.value })) },
      benchmark: benchmark && benchmarkSnapshots
        ? { symbol: benchmark.symbol, points: benchmarkSnapshots.map((item) => ({ date: item.sessionDate, value: item.value })) }
        : null,
      fromDate,
      throughDate,
      adjustment: "split_adjusted_price_return_excluding_dividends",
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, error instanceof Error ? error.message : "Market data is temporarily unavailable.");
  }
}
