import "server-only";
import type { ServerSupabase } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";
import { reasoningReviewSchema, type ReasoningReview } from "./contracts";

export async function persistReasoningReview(
  trusted: ServerSupabase,
  review: ReasoningReview,
) {
  const { data, error } = await trusted.rpc("persist_reasoning_review", {
    p_claim_version_id: review.claimVersionId,
    p_payload: review,
  });
  if (error) throw new HttpError(503, "The evidence review could not be saved.");
  return reasoningReviewSchema.parse({ ...review, id: data ?? review.id });
}
