import "server-only";
import { z } from "zod";
import { getMassiveConfig } from "@/lib/server/env";
import { nyseCloseAt, nyseAvailableAt } from "./nyse-calendar";
import {
  priceSnapshotSchema,
  type MarketDataAdapter,
  type ObservationRequest,
  type PriceSnapshot,
} from "./contracts";

const responseSchema = z.object({
  results: z.array(z.object({ t: z.number(), c: z.number().finite() })).default([]),
  status: z.string().optional(),
  next_url: z.string().optional(),
});

function dateFromTimestamp(timestamp: number) {
  // Massive daily aggregate timestamps identify the UTC calendar day of the bar.
  return new Date(timestamp).toISOString().slice(0, 10);
}

function sourceUrl(symbol: string, fromDate: string, throughDate: string) {
  return `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${fromDate}/${throughDate}`;
}

export class MassiveAdapter implements MarketDataAdapter {
  async getObservations(request: ObservationRequest): Promise<PriceSnapshot[]> {
    const config = getMassiveConfig();
    if (!config) throw new Error("MASSIVE_API_KEY is not configured.");
    if (request.instrument.assetClass !== "stock" && request.instrument.assetClass !== "etf")
      throw new Error("Massive live resolution currently supports U.S. stocks and ETFs only.");
    const symbol = request.instrument.symbol.toUpperCase();
    const url = new URL(
      `${config.baseUrl}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${request.fromDate}/${request.throughDate}`,
    );
    url.searchParams.set("adjusted", request.adjustment === "split_adjusted" ? "true" : "false");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("limit", "50000");
    url.searchParams.set("apiKey", config.apiKey);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      if (response.status === 401)
        throw new Error(
          "Massive rejected the API key (HTTP 401). Check MASSIVE_API_KEY and its plan access.",
        );
      throw new Error(`Massive returned HTTP ${response.status}.`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Massive returned an invalid aggregate response.");
    if (parsed.data.status === "ERROR") throw new Error("Massive rejected the aggregate request.");
    if (parsed.data.next_url)
      throw new Error(
        "Market data was truncated. This window must be fetched completely before resolution.",
      );
    const retrievedAt = new Date().toISOString();
    const endpoint = sourceUrl(symbol, request.fromDate, request.throughDate);
    return parsed.data.results
      .filter(
        (bar) => Date.parse(nyseAvailableAt(dateFromTimestamp(bar.t))) <= Date.parse(retrievedAt),
      )
      .map((bar) => {
        const sessionDate = dateFromTimestamp(bar.t);
        const observedAt = nyseCloseAt(sessionDate);
        const snapshot = {
          id: `massive:${symbol}:${sessionDate}`,
          instrument: request.instrument,
          value: bar.c,
          sessionDate,
          observedAt,
          // EOD bars are published after the session; the exact publication time is not supplied by the API.
          availableAt: nyseAvailableAt(sessionDate),
          retrievedAt,
          source: {
            provider: "massive",
            seriesId: symbol,
            sourceUrl: endpoint,
            isSynthetic: false,
          },
          adjustment: request.adjustment,
          adjustmentBasisId:
            request.adjustment === "split_adjusted"
              ? `massive:split_adjusted:${retrievedAt}`
              : "massive:raw:v1",
        } satisfies PriceSnapshot;
        return priceSnapshotSchema.parse(snapshot);
      });
  }
}

export const massiveAdapter = new MassiveAdapter();
