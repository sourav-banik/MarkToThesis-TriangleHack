import { requireAccount } from "@/features/auth/server";
import { reviewWithClaude } from "@/features/ai/review";
import { reasoningReviewRequestSchema } from "@/features/ai/review-contracts";
import { persistReasoningReview } from "@/features/ai/review-server";
import { getLiveClaim } from "@/features/claims/server";
import { acquireParserSlot } from "@/features/ai/limits";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";
import { createSupabaseTrustedClient } from "@/lib/server/supabase";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let release: (() => void) | undefined;
  try {
    requireSameOrigin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const account = await requireAccount();
    const record = await getLiveClaim(account.client, id);
    if (record.claim.version.authorId !== account.user.id)
      throw new HttpError(403, "Only the claim owner can review its reasoning.");
    if (record.claim.version.terms.assumptions.length === 0)
      throw new HttpError(400, "This claim has no saved assumptions to review.");
    const input = await readJson(request, reasoningReviewRequestSchema);
    const now = new Date().toISOString();
    if (input.evidence.some((item) => Date.parse(item.publishedAt) > Date.parse(now)))
      throw new HttpError(400, "Evidence publication dates cannot be in the future.");
    input.evidence = input.evidence.map((item) => ({
      ...item,
      retrievedAt: now,
      suppliedBy: "author",
    }));
    const trusted = createSupabaseTrustedClient();
    if (!trusted)
      throw new HttpError(503, "Trusted Supabase server credentials are not configured.");
    if (!process.env.ANTHROPIC_API_KEY)
      throw new HttpError(503, "Claude is not configured for evidence review.");
    release = acquireParserSlot(account.user.id);
    const review = await reviewWithClaude(
      record.claim.version,
      input,
      new Date().toISOString(),
      request.signal,
    );
    return privateJson(await persistReasoningReview(trusted, review), 201);
  } catch (error) {
    return apiError(error);
  } finally {
    release?.();
  }
}
