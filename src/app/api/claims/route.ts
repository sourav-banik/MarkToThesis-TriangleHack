import { requireAccount } from "@/features/auth/server";
import { liveClaimRequestSchema } from "@/features/claims/live-contracts";
import { claimCursorSchema, commitLiveClaim, listLiveClaims } from "@/features/claims/server";
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
    const publicClient = createPublicSupabaseClient();
    if (!publicClient) return privateJson({ configured: false, claims: [], nextCursor: null });
    const account = mode === "mine" ? await requireAccount() : null;
    const client = account?.client ?? publicClient;
    let ownerId: string | undefined;
    if (account) ownerId = account.user.id;
    const beforeTime = url.searchParams.get("beforeTime"),
      beforeId = url.searchParams.get("beforeId");
    const cursor =
      beforeTime || beforeId
        ? claimCursorSchema.safeParse({ createdAt: beforeTime, id: beforeId })
        : null;
    if (cursor && !cursor.success) throw new HttpError(400, "Invalid page cursor.");
    const page = await listLiveClaims(client, {
      ownerId,
      publicOnly: mode === "public",
      cursor: cursor?.success ? cursor.data : undefined,
    });
    return privateJson({ configured: true, ...page });
  } catch (error) {
    return apiError(error);
  }
}
