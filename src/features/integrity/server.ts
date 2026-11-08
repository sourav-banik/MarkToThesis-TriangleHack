import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PersistedClaim } from "@/features/claims/live-contracts";
import type { ServerSupabase } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";
import { anchorSchema } from "./contracts";

// JSON key order is stable across clients, databases, and independent verification.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}
export function commitmentProof(claim: PersistedClaim) {
  const payload = {
    protocol: "marktothesis-base-v1",
    kind: "commitment",
    version: claim.version,
    marketBindings: claim.marketBindings,
    supersedesClaimId: claim.supersedesClaimId,
  };
  const canonical = canonicalJson(payload);
  const digest = createHash("sha256").update(canonical).digest("hex");
  return {
    payload,
    canonical,
    digest,
    data: `0x${Buffer.from(`MarkToThesis:v1:${digest}`).toString("hex")}`,
  };
}
export function resolutionProof(claim: PersistedClaim) {
  if (!claim.resolution)
    throw new HttpError(400, "Resolve this claim before anchoring its outcome.");
  const payload = {
    protocol: "marktothesis-base-v1",
    kind: "resolution",
    commitmentDigest: commitmentProof(claim).digest,
    resolution: claim.resolution,
  };
  const canonical = canonicalJson(payload);
  const digest = createHash("sha256").update(canonical).digest("hex");
  return {
    payload,
    canonical,
    digest,
    data: `0x${Buffer.from(`MarkToThesis:v1:${digest}`).toString("hex")}`,
  };
}
export async function listAnchors(client: ServerSupabase, versionId: string) {
  const { data, error } = await client
    .from("claim_anchors")
    .select("id,digest,transaction_hash,block_number,block_hash,anchored_at,record_kind")
    .eq("claim_version_id", versionId)
    .order("anchored_at");
  if (error) throw new HttpError(503, "Blockchain proofs need migration 006 applied to Supabase.");
  return z.array(anchorSchema).parse(data ?? []);
}
export async function rpc(method: string, params: unknown[]) {
  try {
    const response = await fetch(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(15000),
    });
    const result = z
      .object({ result: z.unknown().optional(), error: z.unknown().optional() })
      .parse(await response.json());
    if (!response.ok || result.error) throw new Error("rpc failed");
    return result.result;
  } catch {
    throw new HttpError(
      503,
      "Base Sepolia could not be reached. Retry proof verification shortly.",
    );
  }
}
export async function verifyAnchor(hash: string, expectedData: string) {
  if ((await rpc("eth_chainId", [])) !== "0x14a34")
    throw new HttpError(503, "The configured RPC is not Base Sepolia.");
  const [transaction, receipt] = await Promise.all([
    rpc("eth_getTransactionByHash", [hash]),
    rpc("eth_getTransactionReceipt", [hash]),
  ]);
  if (!transaction || !receipt)
    throw new HttpError(409, "Transaction is pending. Verify it again after confirmation.");
  const tx = z
    .object({ hash: z.string(), input: z.string(), blockHash: z.string(), blockNumber: z.string() })
    .parse(transaction);
  const confirmation = z
    .object({
      transactionHash: z.string(),
      status: z.string(),
      blockHash: z.string(),
      blockNumber: z.string(),
    })
    .parse(receipt);
  if (
    tx.hash.toLowerCase() !== hash.toLowerCase() ||
    confirmation.transactionHash.toLowerCase() !== hash.toLowerCase() ||
    tx.input.toLowerCase() !== expectedData.toLowerCase() ||
    confirmation.status !== "0x1" ||
    tx.blockHash !== confirmation.blockHash ||
    tx.blockNumber !== confirmation.blockNumber
  )
    throw new HttpError(422, "The transaction does not confirm this exact record hash.");
  const block = z
    .object({ hash: z.string(), timestamp: z.string() })
    .parse(await rpc("eth_getBlockByNumber", [confirmation.blockNumber, false]));
  if (block.hash !== confirmation.blockHash)
    throw new HttpError(409, "Block changed. Retry verification after confirmation.");
  return {
    blockNumber: Number(BigInt(confirmation.blockNumber)),
    blockHash: block.hash,
    anchoredAt: new Date(Number(BigInt(block.timestamp)) * 1000).toISOString(),
  };
}
