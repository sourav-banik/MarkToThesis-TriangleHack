import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient } from "@supabase/supabase-js";
import type { ServerSupabase } from "@/lib/server/supabase";
import { defaultTerms } from "@/demo/claims";
import { instruments } from "@/features/market-data/catalog";
import { defaultFeedFilters } from "./contracts";
import { getRecordSummary, listClaimFeed } from "./server";
import { getPublicProfile } from "@/features/profiles/server";

const owner = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-11-07T18:00:00.123456+00:00";
const uid = (index: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString().padStart(12, "0")}`;
function row(index: number) {
  return {
    id: uid(index),
    author_id: owner,
    visibility: "public",
    initial_status: "awaiting_start",
    created_at: timestamp,
    supersedes_claim_id: null,
    author: { id: owner, handle: "analyst", display_name: "Analyst", bio: "Independent calls" },
    claim_versions: [
      {
        id: uid(index + 100),
        claim_id: uid(index),
        version: 1,
        original_text: `Original call ${index}`,
        terms: {
          ...defaultTerms,
          assumptions: [],
          instrument: instruments.aapl,
          horizon: { kind: "duration", value: 30, unit: "days" },
          prediction: { kind: "outperform", metric: "price_return", benchmark: instruments.spy },
        },
        market_bindings: {},
        context: { kind: "live" },
        committed_at: timestamp,
      },
    ],
  };
}
function fixture(data: unknown, status = 200) {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createClient("https://fixture.example", "sb_publishable_fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetcher },
  }) as ServerSupabase;
  return { client, fetcher };
}
function requestUrl(fetcher: ReturnType<typeof fixture>["fetcher"], index = 0) {
  return new URL(String((fetcher.mock.calls[index] as unknown[])[0]));
}

describe("database feed read service", () => {
  it("filters before pagination and binds authors without selecting credentials or request metadata", async () => {
    const { client, fetcher } = fixture([row(1)]);
    const page = await listClaimFeed(
      client,
      { publicOnly: true },
      {
        ...defaultFeedFilters,
        q: "100%_",
        kind: "outperform",
        instrumentId: instruments.aapl.id,
        horizon: "years",
      },
    );
    const params = requestUrl(fetcher).searchParams;
    expect(params.get("visibility")).toBe("eq.public");
    expect(params.get("claim_versions.original_text")).toBe("imatch.100%_");
    expect(params.get("claim_versions.terms->prediction->>kind")).toBe("eq.outperform");
    expect(params.get("claim_versions.terms->instrument->>id")).toBe(`eq.${instruments.aapl.id}`);
    expect(params.get("claim_versions.terms->horizon->>unit")).toBe("eq.years");
    expect(params.get("select")).toContain("claim_versions!inner(");
    expect(params.get("select")).toContain("author:profiles!claims_author_id_fkey(");
    expect(params.get("select")).not.toMatch(/email|request_hash|idempotency_key/);
    expect(page.claims[0].author.displayName).toBe("Analyst");
    expect(page.claims[0].version.committedAt).toBe(timestamp);
  });
  it("returns 20 records and uses the last visible timestamp plus UUID for the next page", async () => {
    const { client, fetcher } = fixture(Array.from({ length: 21 }, (_, index) => row(index + 1)));
    const page = await listClaimFeed(client, { publicOnly: true });
    expect(page.claims).toHaveLength(20);
    expect(page.nextCursor).toEqual({ createdAt: timestamp, id: uid(20) });
    await listClaimFeed(client, { publicOnly: true }, defaultFeedFilters, page.nextCursor);
    expect(requestUrl(fetcher, 1).searchParams.get("or")).toBe(
      `(created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${uid(20)}))`,
    );
  });
  it("scopes private filters to the supplied verified owner and rejects them on public reads", async () => {
    const { client, fetcher } = fixture([]);
    const filters = {
      ...defaultFeedFilters,
      visibility: "private" as const,
      status: "unscored" as const,
      horizon: "date" as const,
    };
    await listClaimFeed(client, { publicOnly: false, ownerId: owner }, filters);
    expect(requestUrl(fetcher).searchParams.get("author_id")).toBe(`eq.${owner}`);
    expect(requestUrl(fetcher).searchParams.get("visibility")).toBe("eq.private");
    expect(requestUrl(fetcher).searchParams.get("initial_status")).toBe("eq.unscored");
    expect(requestUrl(fetcher).searchParams.get("claim_versions.terms->horizon->>kind")).toBe(
      "eq.date",
    );
    await expect(listClaimFeed(client, { publicOnly: true }, filters)).rejects.toMatchObject({
      status: 400,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never replaces a failed provider read with fabricated results", async () => {
    const { client } = fixture({ code: "42501", message: "private internal details" }, 403);
    await expect(listClaimFeed(client, { publicOnly: true })).rejects.toMatchObject({
      status: 503,
    });
    await expect(listClaimFeed(client, { publicOnly: true })).rejects.not.toThrow(
      "internal details",
    );
  });
  it("summarizes saved outcomes without inferring a score from current prices", async () => {
    const fetcher = vi.fn(async () =>
      Response.json([
        { initial_status: "awaiting_start", claim_versions: [{ resolutions: [] }] },
        { initial_status: "unscored", claim_versions: [{ resolutions: [] }] },
      ]),
    );
    const client = createClient("https://fixture.example", "sb_publishable_fixture", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetcher },
    }) as ServerSupabase;
    expect(await getRecordSummary(client, { ownerId: owner, publicOnly: true })).toEqual({
      total: 2,
      scored: 0,
      met: 0,
      notMet: 0,
      pending: 1,
      unclear: 0,
      unscored: 1,
    });
    for (const [url, init] of fetcher.mock.calls as unknown as [string, RequestInit][]) {
      const params = new URL(url).searchParams;
      expect(params.get("visibility")).toBe("eq.public");
      expect(params.get("author_id")).toBe(`eq.${owner}`);
      expect(params.get("select")).toContain("resolutions(payload,recorded_at)");
      expect(init.method).toBe("GET");
    }
  });
  it("looks up only safe public profile fields and gives a real not-found result", async () => {
    const { client, fetcher } = fixture([]);
    await expect(getPublicProfile(client, "missing_author")).rejects.toMatchObject({ status: 404 });
    expect(requestUrl(fetcher).searchParams.get("select")).toBe("id,handle,display_name,bio");
    await expect(getPublicProfile(client, "bad/handle")).rejects.toMatchObject({ status: 404 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
