import nextEnv from "@next/env";
import { instruments } from "../src/features/market-data/catalog";
import { MassiveAdapter } from "../src/features/market-data/massive";
import { buildNyseSchedule } from "../src/features/market-data/nyse-calendar";
import { standardClaimFields } from "../src/features/claims/conventions";
import { committedClaimVersionSchema } from "../src/features/claims/contracts";
import { resolveClaim } from "../src/features/resolution/resolve";
import { explainOutcome } from "../src/features/ai/outcome-explanation";
nextEnv.loadEnvConfig(process.cwd());
const now = new Date().toISOString();
const fromDate = "2026-09-01",
  throughDate = "2026-10-16";
const claim = committedClaimVersionSchema.parse({
  id: crypto.randomUUID(),
  claimId: crypto.randomUUID(),
  authorId: "smoke-check-only",
  version: 1,
  originalText: "AAPL will outperform SPY over 30 calendar days.",
  terms: {
    ...standardClaimFields,
    instrument: instruments.aapl,
    prediction: { kind: "outperform", metric: "price_return", benchmark: instruments.spy },
    horizon: { kind: "duration", value: 30, unit: "days" },
  },
  committedAt: now,
  publishedAt: null,
  visibility: "private",
  supersedesVersionId: null,
  context: {
    kind: "replay",
    simulatedCommitmentAt: `${fromDate}T12:00:00Z`,
    datasetId: "massive-smoke-check",
  },
});
const adapter = new MassiveAdapter();
async function series(instrument: typeof instruments.aapl) {
  const observations = await adapter.getObservations({
    instrument,
    fromDate,
    throughDate,
    adjustment: "split_adjusted",
  });
  return {
    observations,
    schedule: buildNyseSchedule(instrument, fromDate, throughDate, observations),
  };
}
const asset = await series(instruments.aapl),
  benchmark = await series(instruments.spy);
const result = resolveClaim({
  resolutionId: crypto.randomUUID(),
  claim,
  asOf: new Date().toISOString(),
  asset,
  benchmark,
});
console.log(
  JSON.stringify({
    assetBars: asset.observations.length,
    benchmarkBars: benchmark.observations.length,
    status: result.status,
    ...("reason" in result
      ? { reason: result.reason, window: result.window, missing: result.missingObservations }
      : {}),
  }),
);
if (result.status !== "met" && result.status !== "not_met")
  throw new Error("Real historical replay did not produce a scored outcome.");
const explanation = await explainOutcome(result.resolution);
console.log(
  JSON.stringify({
    explanationAvailable: !!explanation,
    sourceCount: explanation?.sources.length ?? 0,
    claimsSaved: 0,
  }),
);
