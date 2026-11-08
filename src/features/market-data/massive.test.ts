import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { instruments } from "./catalog";
import { MassiveAdapter } from "./massive";

describe("Massive daily adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MASSIVE_API_KEY;
  });

  it("normalizes split-adjusted bars without exposing the API key in the source URL", async () => {
    process.env.MASSIVE_API_KEY = "test-massive-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ t: Date.parse("2026-11-05T00:00:00Z"), c: 123.45 }] }), { status: 200 })));
    const [snapshot] = await new MassiveAdapter().getObservations({ instrument: instruments.aapl, fromDate: "2026-11-01", throughDate: "2026-11-06", adjustment: "split_adjusted" });
    expect(snapshot.sessionDate).toBe("2026-11-05");
    expect(snapshot.source.provider).toBe("massive");
    expect(snapshot.source.sourceUrl).not.toContain("test-massive-key");
    expect(snapshot.adjustment).toBe("split_adjusted");
  });

  it("fails clearly when credentials are absent", async () => {
    await expect(new MassiveAdapter().getObservations({ instrument: instruments.aapl, fromDate: "2026-11-01", throughDate: "2026-11-06", adjustment: "split_adjusted" })).rejects.toThrow("MASSIVE_API_KEY");
  });
});
