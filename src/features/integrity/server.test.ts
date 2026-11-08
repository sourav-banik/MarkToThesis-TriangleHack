import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canonicalJson, commitmentProof, verifyAnchor } from "./server";
import { createReplayRecord } from "@/features/replay/dataset";
import { initialReplayTerms } from "@/features/replay/dataset";
import type { PersistedClaim } from "@/features/claims/live-contracts";
const hash = `0x${"a".repeat(64)}`;
afterEach(() => vi.unstubAllGlobals());
describe("blockchain proof verification", () => {
  it("hashes stable JSON and detects edited terms", () => {
    expect(canonicalJson({ b: [2, 1], a: 3 })).toBe(canonicalJson({ a: 3, b: [2, 1] }));
    const claim: PersistedClaim = {
      version: createReplayRecord(
        initialReplayTerms(),
        "Original",
        "replay-test",
        "2026-11-08T15:00:00Z",
      ).claim,
      status: "awaiting_start",
      marketBindings: {},
      supersedesClaimId: null,
    };
    const original = commitmentProof(claim).digest;
    claim.version.originalText = "Edited";
    expect(commitmentProof(claim).digest).not.toBe(original);
  });
  it("rejects a real-looking successful receipt whose transaction contains a different hash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const method = JSON.parse(init.body).method;
        const result =
          method === "eth_chainId"
            ? "0x14a34"
            : method === "eth_getTransactionByHash"
              ? { hash, input: "0xdead", blockHash: hash, blockNumber: "0x10" }
              : { transactionHash: hash, status: "0x1", blockHash: hash, blockNumber: "0x10" };
        return Response.json({ result });
      }),
    );
    await expect(verifyAnchor(hash, "0xbeef")).rejects.toMatchObject({ status: 422 });
  });
  it("does not mark pending transactions as anchored", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) =>
        Response.json({
          result: JSON.parse(init.body).method === "eth_chainId" ? "0x14a34" : null,
        }),
      ),
    );
    await expect(verifyAnchor(hash, "0xbeef")).rejects.toMatchObject({ status: 409 });
  });
});
