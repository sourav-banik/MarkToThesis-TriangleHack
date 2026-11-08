import { requireAccount } from "@/features/auth/server";
import { acquireParserSlot } from "@/features/ai/limits";
import { MassiveAdapter } from "@/features/market-data/massive";
import { buildNyseSchedule } from "@/features/market-data/nyse-calendar";
import {
  marketReplayClaimSchema,
  marketReplayRequestSchema,
} from "@/features/replay/market-contracts";
import { resolveClaim } from "@/features/resolution/resolve";
import { targetDateForHorizon } from "@/features/resolution/calendar";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";
import { calendarDateAt } from "@/lib/dates";
import { explainOutcome } from "@/features/ai/outcome-explanation";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    requireSameOrigin(request);
    const account = await requireAccount();
    const input = await readJson(request, marketReplayRequestSchema);
    const now = new Date().toISOString();
    const today = calendarDateAt(now, "America/New_York")!;
    if (input.simulatedDate < "2024-01-01" || input.simulatedDate >= today)
      throw new HttpError(
        400,
        "Choose a historical date between 2024-01-01 and yesterday. Your provider plan must cover it.",
      );
    release = acquireParserSlot(account.user.id);
    const target = targetDateForHorizon(input.simulatedDate, input.terms.horizon);
    if (!target.ok) throw new HttpError(400, target.reason);
    const upper = new Date(Date.parse(`${target.date}T00:00:00Z`) + 14 * 86400000)
      .toISOString()
      .slice(0, 10);
    const throughDate = [upper, today].sort()[0];
    if (Date.parse(throughDate) - Date.parse(input.simulatedDate) > 400 * 86400000)
      throw new HttpError(400, "Choose a replay window up to one year for this demo.");
    const claim = marketReplayClaimSchema.parse({
      id: crypto.randomUUID(),
      claimId: crypto.randomUUID(),
      authorId: account.user.id,
      version: 1,
      originalText: input.originalText,
      terms: input.terms,
      committedAt: now,
      publishedAt: null,
      visibility: "private",
      context: {
        kind: "replay",
        simulatedCommitmentAt: `${input.simulatedDate}T12:00:00Z`,
        datasetId: "massive-historical-replay-v1",
      },
      supersedesVersionId: null,
    });
    const adapter = new MassiveAdapter();
    async function series(
      instrument: typeof input.terms.instrument,
      adjustment: "split_adjusted" | "unadjusted",
    ) {
      const observations = await adapter.getObservations({
        instrument,
        fromDate: input.simulatedDate,
        throughDate,
        adjustment,
      });
      return {
        observations,
        schedule: buildNyseSchedule(instrument, input.simulatedDate, throughDate, observations),
      };
    }
    const prediction = input.terms.prediction;
    const asset = await series(
      input.terms.instrument,
      prediction.kind === "range" && prediction.metric === "quoted_value"
        ? "unadjusted"
        : "split_adjusted",
    );
    const benchmark =
      prediction.kind === "outperform" || prediction.kind === "underperform"
        ? await series(prediction.benchmark, "split_adjusted")
        : null;
    const attempt = resolveClaim({
      resolutionId: crypto.randomUUID(),
      claim,
      asOf: new Date().toISOString(),
      asset,
      benchmark,
    });
    // An explanation failure never replaces or hides the deterministic outcome.
    const explanation =
      "resolution" in attempt
        ? await explainOutcome(attempt.resolution, request.signal).catch(() => null)
        : null;
    return privateJson({ claim, attempt, explanation, recordedAt: now, replay: true });
  } catch (error) {
    return apiError(
      error instanceof HttpError
        ? error
        : new HttpError(
            503,
            "Historical prices could not be loaded. Check provider access and choose a date covered by your plan.",
          ),
    );
  } finally {
    release?.();
  }
}
