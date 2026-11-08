import { profileSchema } from "@/features/profiles/contracts";
import { listLiveClaims, claimCursorSchema } from "@/features/claims/server";
import { createPublicSupabaseClient } from "@/lib/server/supabase";
import { apiError, HttpError, privateJson } from "@/lib/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    if (!/^[a-z0-9_]{3,40}$/.test(handle)) throw new HttpError(404, "This author is unavailable.");
    const client = createPublicSupabaseClient();
    if (!client) throw new HttpError(503, "Live author records are not connected yet.");
    const { data, error } = await client
      .from("profiles")
      .select("id,handle,display_name,bio")
      .eq("handle", handle)
      .maybeSingle();
    if (error) throw new HttpError(503, "Author records are temporarily unavailable.");
    if (!data) throw new HttpError(404, "This author is unavailable.");
    const profile = profileSchema.parse({
      id: data.id,
      handle: data.handle,
      displayName: data.display_name,
      bio: data.bio,
    });
    const url = new URL(request.url);
    const time = url.searchParams.get("beforeTime"),
      id = url.searchParams.get("beforeId");
    const cursor = time || id ? claimCursorSchema.safeParse({ createdAt: time, id }) : null;
    if (cursor && !cursor.success) throw new HttpError(400, "Invalid page cursor.");
    return privateJson({
      profile,
      ...(await listLiveClaims(client, {
        ownerId: profile.id,
        publicOnly: true,
        cursor: cursor?.success ? cursor.data : undefined,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
