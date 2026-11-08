import { z } from "zod";
import { requireAccount } from "@/features/auth/server";
import { commentRequestSchema } from "@/features/comments/contracts";
import { createClaimComment, listClaimComments } from "@/features/comments/server";
import { apiError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";
import { createVerifiedReadClient } from "@/lib/server/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    z.uuid().parse(id);
    const client = await createVerifiedReadClient();
    if (!client) return privateJson({ configured: false, comments: [] });
    return privateJson({ configured: true, comments: await listClaimComments(client, id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const account = await requireAccount();
    const body = await readJson(request, commentRequestSchema);
    return privateJson(await createClaimComment(account.client, id, account.user.id, body.body), 201);
  } catch (error) {
    return apiError(error);
  }
}
