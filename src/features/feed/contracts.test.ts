import { describe, expect, it } from "vitest";
import {
  defaultFeedFilters,
  literalSearchPattern,
  parseFeedQuery,
  writeFeedFilters,
} from "./contracts";

describe("feed query validation", () => {
  it("keeps defaults explicit and preserves full database cursor precision", () => {
    const params = new URLSearchParams({
      beforeTime: "2026-11-07T18:00:00.123456+00:00",
      beforeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const parsed = parseFeedQuery(params);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.filters).toEqual(defaultFeedFilters);
      expect(parsed.data.cursor?.createdAt).toBe(params.get("beforeTime"));
    }
  });
  it.each([
    { beforeTime: "2026-11-07T00:00:00Z" },
    { beforeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    { beforeTime: "bad),visibility.eq.private", beforeId: "not-a-uuid" },
    { kind: "invented_win" },
    { status: "met" },
    { horizon: "forever" },
    { instrumentId: "unknown:asset" },
    { q: "x".repeat(121) },
  ])("rejects invalid filter or cursor input %o", (input) => {
    const entries = Object.entries(input).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    );
    expect(parseFeedQuery(new URLSearchParams(entries)).success).toBe(false);
  });
  it("round-trips filter values without interpolating them into a raw query", () => {
    const params = new URLSearchParams();
    writeFeedFilters(params, {
      ...defaultFeedFilters,
      q: "gold, oil (50%)",
      kind: "range",
      horizon: "years",
    });
    const parsed = parseFeedQuery(params);
    expect(parsed.success && parsed.data.filters.q).toBe("gold, oil (50%)");
    expect(params.has("visibility")).toBe(false);
  });
  it("treats percentages, underscores, asterisks, and regex punctuation as literal text", () => {
    expect(literalSearchPattern("100%_* (AAPL)+?\\")).toBe("100%_\\* \\(AAPL\\)\\+\\?\\\\");
  });
});
