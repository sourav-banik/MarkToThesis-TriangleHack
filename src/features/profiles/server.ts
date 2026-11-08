import "server-only";
import { profileSchema } from "./contracts";
import type { ServerSupabase } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";

export function mapPublicProfile(value: {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
}) {
  return profileSchema.parse({
    id: value.id,
    handle: value.handle,
    displayName: value.display_name,
    bio: value.bio,
  });
}
export async function getPublicProfile(client: ServerSupabase, handle: string) {
  if (!/^[a-z0-9_]{3,40}$/.test(handle)) throw new HttpError(404, "This author is unavailable.");
  const { data, error } = await client
    .from("profiles")
    .select("id,handle,display_name,bio")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new HttpError(503, "Author records are temporarily unavailable.");
  if (!data) throw new HttpError(404, "This author is unavailable.");
  return mapPublicProfile(data);
}
