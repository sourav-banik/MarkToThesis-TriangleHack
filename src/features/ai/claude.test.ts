import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/env", () => ({ getClaudeConfig: vi.fn() }));
import { getClaudeConfig } from "@/lib/server/env";
import { extractWithClaude } from "./claude";
import { completeCall, comparisonExtraction } from "./test-fixtures";
import { parserRequestSchema } from "./parser-contracts";

const input = parserRequestSchema.parse({ originalText: completeCall });
beforeEach(() => {
  vi.mocked(getClaudeConfig).mockReturnValue({
    apiKey: "fixture-secret",
    model: "claude-haiku-4-5-20251001",
  });
});
afterEach(() => vi.unstubAllGlobals());
const envelope = (stopReason = "end_turn", extraction: unknown = comparisonExtraction()) => ({
  model: "claude-haiku-4-5-20251001",
  stop_reason: stopReason,
  content: [{ type: "text", text: JSON.stringify(extraction) }],
});
describe("Claude server adapter", () => {
  it("uses the real structured-output API shape and never includes credentials in user content", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(envelope()));
    vi.stubGlobal("fetch", fetcher);
    const result = await extractWithClaude(input, "2026-11-07T20:00:00Z");
    const [url, init] = fetcher.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("fixture-secret");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.messages[0].content).not.toContain("fixture-secret");
    expect(body).not.toHaveProperty("tools");
    expect(body.max_tokens).toBe(3000);
    expect(result.extraction.kind.value).toBe("outperform");
  });
  it("fails honestly without a key and makes no network call", async () => {
    vi.mocked(getClaudeConfig).mockReturnValue(null);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(extractWithClaude(input, "2026-11-07T20:00:00Z")).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [401, 503],
    [402, 503],
    [404, 503],
    [429, 429],
    [529, 502],
  ])("maps provider HTTP %s to a safe error", async (providerStatus, expectedStatus) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: "private provider credential detail" } },
            { status: providerStatus },
          ),
        ),
    );
    await expect(extractWithClaude(input, "2026-11-07T20:00:00Z")).rejects.toMatchObject({
      status: expectedStatus,
    });
    await expect(extractWithClaude(input, "2026-11-07T20:00:00Z")).rejects.not.toThrow(
      "credential detail",
    );
  });
  it.each(["max_tokens", "refusal"])(
    'does not accept a "%s" response as a proposal',
    async (reason) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(envelope(reason))));
      await expect(extractWithClaude(input, "2026-11-07T20:00:00Z")).rejects.toMatchObject({
        status: reason === "refusal" ? 422 : 502,
      });
    },
  );
  it("rejects invalid JSON and hallucinated fields even with a normal end_turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(envelope("end_turn", { ...comparisonExtraction(), outcome: "met" })),
        ),
    );
    await expect(extractWithClaude(input, "2026-11-07T20:00:00Z")).rejects.toMatchObject({
      status: 502,
    });
  });
  it("distinguishes a timeout from cancellation and never returns raw exceptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("private timeout details", "TimeoutError")),
    );
    await expect(extractWithClaude(input, "2026-11-07T20:00:00Z")).rejects.toMatchObject({
      status: 504,
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      extractWithClaude(input, "2026-11-07T20:00:00Z", controller.signal),
    ).rejects.toMatchObject({ status: 499 });
  });
});
