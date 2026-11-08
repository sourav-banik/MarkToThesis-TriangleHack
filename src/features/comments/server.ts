import "server-only";
import type { ServerSupabase } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";
import { profileSchema } from "@/features/profiles/contracts";
import { commentBodySchema, commentSchema, type Comment } from "./contracts";

const commentRowSchema = commentSchema.transform((comment) => comment);
const commentColumns = "id,claim_id,author_id,body,created_at,author:profiles!comments_author_id_fkey(id,handle,display_name,bio)";

function mapComment(value: unknown) {
  const row = value as Record<string, unknown>;
  const author = row.author as Record<string, unknown>;
  return commentRowSchema.parse({
    id: row.id,
    claimId: row.claim_id,
    author: profileSchema.parse({
      id: author.id,
      handle: author.handle,
      displayName: author.display_name,
      bio: author.bio,
    }),
    body: row.body,
    createdAt: row.created_at,
  });
}

export async function listClaimComments(client: ServerSupabase, claimId: string): Promise<Comment[]> {
  const { data, error } = await client
    .from("comments")
    .select(commentColumns)
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);
  if (error) throw new HttpError(503, "Comments are temporarily unavailable.");
  return (data ?? []).map(mapComment);
}

export async function createClaimComment(
  client: ServerSupabase,
  claimId: string,
  authorId: string,
  body: string,
) {
  const parsedBody = commentBodySchema.parse(body);
  const { data, error } = await client
    .from("comments")
    .insert({ claim_id: claimId, author_id: authorId, body: parsedBody })
    .select(commentColumns)
    .single();
  if (error) {
    if (error.code === "42501") throw new HttpError(403, "You cannot comment on this claim.");
    if (error.code?.startsWith("22")) throw new HttpError(400, "Keep comments between 1 and 2,000 characters.");
    throw new HttpError(503, "The comment could not be saved.");
  }
  return mapComment(data);
}
