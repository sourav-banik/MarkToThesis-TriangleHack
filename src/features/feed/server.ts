import "server-only";
import { z } from "zod";
import type { ServerSupabase } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";
import { mapLiveClaim, claimRowSchema, claimColumns } from "@/features/claims/server";
import { mapPublicProfile } from "@/features/profiles/server";
import {
  defaultFeedFilters,
  feedRecordSchema,
  literalSearchPattern,
  type FeedCursor,
  type FeedFilters,
} from "./contracts";

export type RecordScope =
  { publicOnly: true; ownerId?: string } | { publicOnly: false; ownerId: string };
const authorRowSchema = z.object({
  id: z.string(),
  handle: z.string(),
  display_name: z.string(),
  bio: z.string(),
});
const feedRowSchema = claimRowSchema.extend({ author: authorRowSchema });

export async function listClaimFeed(
  client: ServerSupabase,
  scope: RecordScope,
  filters: FeedFilters = defaultFeedFilters,
  cursor: FeedCursor | null = null,
) {
  // Inner embedding filters the parents too; left embedding can otherwise return empty versions.
  const columns =
    claimColumns.replace("claim_versions(", "claim_versions!inner(") +
    ",author:profiles!claims_author_id_fkey(id,handle,display_name,bio)";
  let query = client
    .from("claims")
    .select(columns)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(21);
  if (scope.ownerId) query = query.eq("author_id", scope.ownerId);
  if (scope.publicOnly) {
    if (filters.visibility === "private")
      throw new HttpError(400, "Private filtering is only available in your own record.");
    query = query.eq("visibility", "public");
  } else if (filters.visibility !== "all") query = query.eq("visibility", filters.visibility);
  if (filters.q)
    query = query.filter("claim_versions.original_text", "imatch", literalSearchPattern(filters.q));
  if (filters.kind !== "all")
    query = query.eq("claim_versions.terms->prediction->>kind", filters.kind);
  if (filters.instrumentId !== "all")
    query = query.eq("claim_versions.terms->instrument->>id", filters.instrumentId);
  if (filters.status !== "all") query = query.eq("initial_status", filters.status);
  if (filters.horizon === "date") query = query.eq("claim_versions.terms->horizon->>kind", "date");
  else if (filters.horizon !== "all")
    query = query.eq("claim_versions.terms->horizon->>unit", filters.horizon);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  const { data, error } = await query;
  if (error) throw new HttpError(503, "Saved claims are temporarily unavailable.");
  const rows = z.array(feedRowSchema).parse(data ?? []);
  const page = rows.slice(0, 20),
    last = page.at(-1);
  return {
    claims: page.map((row) =>
      feedRecordSchema.parse({ ...mapLiveClaim(row), author: mapPublicProfile(row.author) }),
    ),
    nextCursor: rows.length > 20 && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

export async function getRecordSummary(client: ServerSupabase, scope: RecordScope) {
  // Exact scoped counts cover all history, independently of list filters and pagination.
  const counts = await Promise.all(
    ["awaiting_start", "unscored"].map(async (status) => {
      let query = client
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("initial_status", status);
      if (scope.ownerId) query = query.eq("author_id", scope.ownerId);
      if (scope.publicOnly) query = query.eq("visibility", "public");
      const { count, error } = await query;
      if (error || count === null)
        throw new HttpError(503, "The record summary is temporarily unavailable.");
      return count;
    }),
  );
  return { awaitingStart: counts[0], unscored: counts[1] };
}
