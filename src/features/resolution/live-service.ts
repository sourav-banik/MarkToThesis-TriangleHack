import "server-only";
import { z } from "zod";
import { calendarDateAt } from "@/lib/dates";
import type { ServerSupabase } from "@/lib/server/supabase";
import { MassiveAdapter } from "../market-data/massive";
import { buildNyseSchedule } from "../market-data/nyse-calendar";
import type { Instrument } from "../market-data/contracts";
import { resolveClaim } from "./resolve";
import type { PersistedClaim } from "../claims/live-contracts";
import { resolutionSchema } from "./contracts";

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function bindingSeries(binding: unknown, fallback: string) {
  const parsed = z.object({ provider: z.string(), seriesId: z.string() }).safeParse(binding);
  return parsed.success ? parsed.data : { provider: "massive", seriesId: fallback };
}

export async function resolveLiveClaim(trusted: ServerSupabase, claim: PersistedClaim, asOf = new Date().toISOString()) {
  const instrument = claim.version.terms.instrument;
  const prediction = claim.version.terms.prediction;
  if (instrument.assetClass !== "stock" && instrument.assetClass !== "etf")
    throw new Error("Massive live resolution currently supports U.S. stocks and ETFs only.");
  const throughDate = calendarDateAt(asOf, instrument.observation.timeZone);
  if (!throughDate) throw new Error("Could not determine the market date for this resolution.");
  const referenceDate = calendarDateAt(claim.version.committedAt, instrument.observation.timeZone);
  if (!referenceDate) throw new Error("Could not determine the commitment market date.");
  const fromDate = shiftDate(referenceDate, -7);
  const adapter = new MassiveAdapter();
  const assetBinding = bindingSeries(claim.marketBindings.asset, instrument.symbol);
  if (assetBinding.provider !== "massive") throw new Error("This claim was committed to a provider other than Massive.");
  const asset = await adapter.getObservations({ instrument, fromDate, throughDate, adjustment: "split_adjusted" });
  const assetSchedule = buildNyseSchedule(instrument, fromDate, throughDate, asset);
  let benchmark: { schedule: ReturnType<typeof buildNyseSchedule>; observations: typeof asset } | null = null;
  if (prediction.kind === "outperform" || prediction.kind === "underperform") {
    const benchmarkInstrument = prediction.benchmark as Instrument;
    const benchmarkBinding = bindingSeries(claim.marketBindings.benchmark, benchmarkInstrument.symbol);
    if (benchmarkBinding.provider !== "massive") throw new Error("This claim's benchmark was committed to a provider other than Massive.");
    const observations = await adapter.getObservations({ instrument: benchmarkInstrument, fromDate, throughDate, adjustment: "split_adjusted" });
    benchmark = { observations, schedule: buildNyseSchedule(benchmarkInstrument, fromDate, throughDate, observations) };
  }
  const attempt = resolveClaim({
    resolutionId: claim.version.id,
    claim: claim.version,
    asOf,
    asset: { schedule: assetSchedule, observations: asset },
    benchmark: benchmark ? { schedule: benchmark.schedule, observations: benchmark.observations } : null,
  });
  if (attempt.status === "met" || attempt.status === "not_met" || attempt.status === "unclear" || attempt.status === "unscored") {
    const resolution = resolutionSchema.parse(attempt.resolution);
    const { data, error } = await trusted.rpc("persist_live_resolution", {
      p_claim_version_id: claim.version.id,
      p_resolution: resolution,
      p_snapshots: [...asset, ...(benchmark?.observations ?? [])],
    });
    if (error) throw new Error(error.message || "The resolution could not be saved.");
    return { attempt, resolutionId: z.uuid().parse(data) };
  }
  return { attempt };
}

export type LiveResolutionResult = Awaited<ReturnType<typeof resolveLiveClaim>>;
