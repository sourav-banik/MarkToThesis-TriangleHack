import { requireAccount } from "@/features/auth/server";
import { liveClaimRequestSchema } from "@/features/claims/live-contracts";
import { commitLiveClaim } from "@/features/claims/server";
import { parseFeedQuery } from "@/features/feed/contracts";
import { getRecordSummary, listClaimFeed, type RecordScope } from "@/features/feed/server";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";
import { createPublicSupabaseClient } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await requireAccount();
    const body = await readJson(request, liveClaimRequestSchema);
    return privateJson(await commitLiveClaim(account.client, body), 201);
  } catch (error) {
    return apiError(error);
  }
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("scope") ?? "public";
    if (mode !== "public" && mode !== "mine") throw new HttpError(400, "Unknown record scope.");
    const parsed = parseFeedQuery(url.searchParams);
    if (!parsed.success) throw new HttpError(400, "Invalid record filters or page cursor.");
    if (mode === "public" && parsed.data.filters.visibility === "private")
      throw new HttpError(400, "Private filtering is only available in your own record.");
    const publicClient = createPublicSupabaseClient();
    if (!publicClient)
      return privateJson({ configured: false, claims: [], nextCursor: null, summary: null });
    const account = mode === "mine" ? await requireAccount() : null;
    const client = account?.client ?? publicClient;
    const scope: RecordScope = account
      ? { ownerId: account.user.id, publicOnly: false }
      : { publicOnly: true };
    const [page, summary] = await Promise.all([
      listClaimFeed(client, scope, parsed.data.filters, parsed.data.cursor),
      account && !parsed.data.cursor ? getRecordSummary(client, scope) : null,
    ]);
    return privateJson({ configured: true, ...page, summary });
  } catch (error) {
    return apiError(error);
  }
}
