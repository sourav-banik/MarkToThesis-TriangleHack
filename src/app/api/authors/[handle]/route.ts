import { getPublicProfile } from "@/features/profiles/server";
import { parseFeedQuery } from "@/features/feed/contracts";
import { listClaimFeed, getRecordSummary } from "@/features/feed/server";
import { createPublicSupabaseClient } from "@/lib/server/supabase";
import { apiError, HttpError, privateJson } from "@/lib/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    if (!/^[a-z0-9_]{3,40}$/.test(handle)) throw new HttpError(404, "This author is unavailable.");
    const client = createPublicSupabaseClient();
    if (!client) throw new HttpError(503, "Live author records are not connected yet.");
    const parsed = parseFeedQuery(new URL(request.url).searchParams);
    if (!parsed.success) throw new HttpError(400, "Invalid record filters or page cursor.");
    if (parsed.data.filters.visibility === "private")
      throw new HttpError(400, "This is a public author record.");
    const profile = await getPublicProfile(client, handle);
    const scope = { ownerId: profile.id, publicOnly: true } as const;
    const [page, summary] = await Promise.all([
      listClaimFeed(client, scope, parsed.data.filters, parsed.data.cursor),
      !parsed.data.cursor ? getRecordSummary(client, scope) : null,
    ]);
    return privateJson({
      configured: true,
      profile,
      ...page,
      summary,
    });
  } catch (error) {
    return apiError(error);
  }
}
