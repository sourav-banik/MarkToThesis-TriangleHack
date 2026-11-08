import { z } from "zod";
import { requireAccount } from "@/features/auth/server";
import { getLiveClaim } from "@/features/claims/server";
import {
  commitmentProof,
  resolutionProof,
  listAnchors,
  verifyAnchor,
} from "@/features/integrity/server";
import { transactionHashSchema } from "@/features/integrity/contracts";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";
import { createVerifiedReadClient, createSupabaseTrustedClient } from "@/lib/server/supabase";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await params).id);
    const client = await createVerifiedReadClient();
    if (!client) throw new HttpError(503, "Accounts are not configured.");
    const { claim } = await getLiveClaim(client, id);
    if (claim.version.visibility !== "public")
      throw new HttpError(400, "Blockchain anchoring is available for public claims only.");
    return privateJson({
      commitment: commitmentProof(claim),
      resolution: claim.resolution ? resolutionProof(claim) : null,
      anchors: await listAnchors(client, claim.version.id),
      chainId: 84532,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const account = await requireAccount();
    const id = z.uuid().parse((await params).id);
    const { claim } = await getLiveClaim(account.client, id);
    if (claim.version.authorId !== account.user.id || claim.version.visibility !== "public")
      throw new HttpError(403, "Only the author can anchor a public claim.");
    const body = await readJson(
      request,
      z.strictObject({
        transactionHash: transactionHashSchema,
        kind: z.enum(["commitment", "resolution"]),
      }),
    );
    const proof = body.kind === "commitment" ? commitmentProof(claim) : resolutionProof(claim);
    const confirmed = await verifyAnchor(body.transactionHash, proof.data);
    const trusted = createSupabaseTrustedClient();
    if (!trusted) throw new HttpError(503, "Trusted proof storage is not configured.");
    const { error } = await trusted.rpc("persist_claim_anchor", {
      p_version_id: claim.version.id,
      p_kind: body.kind,
      p_digest: proof.digest,
      p_tx_hash: body.transactionHash.toLowerCase(),
      p_block_number: confirmed.blockNumber,
      p_block_hash: confirmed.blockHash,
      p_anchored_at: confirmed.anchoredAt,
    });
    if (error)
      throw new HttpError(
        503,
        "The transaction was verified but proof storage failed. Retry verification safely.",
      );
    return privateJson({ verified: true, ...confirmed });
  } catch (error) {
    return apiError(error);
  }
}
