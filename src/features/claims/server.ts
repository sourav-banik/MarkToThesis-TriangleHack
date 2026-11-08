import "server-only";
import { z } from "zod";
import type { ServerSupabase } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";
import { persistedClaimSchema, type LiveClaimRequest } from "./live-contracts";
import { profileSchema } from "../profiles/contracts";
import { resolutionSchema } from "../resolution/contracts";
import { reasoningReviewSchema } from "../ai/contracts";

export const claimColumns =
  "id,author_id,visibility,initial_status,created_at,supersedes_claim_id,claim_versions(id,claim_id,version,original_text,terms,market_bindings,context,committed_at,resolutions(id,payload,recorded_at),reasoning_reviews(id,payload,recorded_at))";
export const claimRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  visibility: z.enum(["public", "private"]),
  initial_status: z.enum(["awaiting_start", "unscored"]),
  created_at: z.string(),
  supersedes_claim_id: z.uuid().nullable(),
  claim_versions: z
    .array(
      z.object({
        id: z.uuid(),
        claim_id: z.uuid(),
        version: z.literal(1),
        original_text: z.string(),
        terms: z.unknown(),
        market_bindings: z.record(z.string(), z.unknown()),
        context: z.unknown(),
        committed_at: z.string(),
        resolutions: z.array(z.object({ id: z.uuid(), payload: z.unknown(), recorded_at: z.string() })).default([]),
        reasoning_reviews: z.array(z.object({ id: z.uuid(), payload: z.unknown(), recorded_at: z.string() })).default([]),
      }),
    )
    .length(1),
});
export function mapLiveClaim(value: unknown) {
  const row = claimRowSchema.parse(value);
  const version = row.claim_versions[0];
  const resolution = [...version.resolutions]
    .sort((left, right) => right.recorded_at.localeCompare(left.recorded_at))
    .map((item) => resolutionSchema.safeParse(item.payload).data)
    .find((item) => item !== undefined) ?? null;
  const reasoningReview = [...version.reasoning_reviews]
    .sort((left, right) => right.recorded_at.localeCompare(left.recorded_at))
    .map((item) => reasoningReviewSchema.safeParse(item.payload).data)
    .find((item) => item !== undefined) ?? null;
  return persistedClaimSchema.parse({
    version: {
      id: version.id,
      claimId: row.id,
      authorId: row.author_id,
      version: version.version,
      originalText: version.original_text,
      terms: version.terms,
      committedAt: version.committed_at,
      publishedAt: row.visibility === "public" ? row.created_at : null,
      visibility: row.visibility,
      context: version.context,
      supersedesVersionId: null,
    },
    status: resolution?.outcome ?? row.initial_status,
    supersedesClaimId: row.supersedes_claim_id,
    marketBindings: version.market_bindings,
    resolution,
    reasoningReview,
  });
}
export async function getLiveClaim(client: ServerSupabase, id: string) {
  const { data, error } = await client
    .from("claims")
    .select(claimColumns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new HttpError(503, "Saved claims are temporarily unavailable.");
  if (!data) throw new HttpError(404, "This claim is unavailable or private.");
  const claim = mapLiveClaim(data);
  const profile = await client
    .from("profiles")
    .select("id,handle,display_name,bio")
    .eq("id", claim.version.authorId)
    .single();
  if (profile.error) throw new HttpError(503, "The author profile is temporarily unavailable.");
  return {
    claim,
    author: profileSchema.parse({
      id: profile.data.id,
      handle: profile.data.handle,
      displayName: profile.data.display_name,
      bio: profile.data.bio,
    }),
  };
}
export async function commitLiveClaim(client: ServerSupabase, request: LiveClaimRequest) {
  const { data, error } = await client.rpc("commit_claim", {
    p_idempotency_key: request.idempotencyKey,
    p_original_text: request.originalText,
    p_terms: request.terms,
    p_visibility: request.visibility,
    p_supersedes_claim_id: request.supersedesClaimId,
  });
  if (error) {
    if (error.code === "23505")
      throw new HttpError(
        409,
        "This submission key already belongs to different terms. Start a new draft to change a logged call.",
      );
    if (error.code === "42501")
      throw new HttpError(403, "You do not have permission to log or link this claim.");
    if (error.code?.startsWith("22") || error.code === "23514")
      throw new HttpError(
        400,
        "These terms cannot be committed. Check the instrument, units, review date, and measurement rules.",
      );
    throw new HttpError(
      503,
      "The claim could not be saved. You can retry the same submission safely.",
    );
  }
  const id = z.uuid().parse(data);
  return getLiveClaim(client, id);
}
