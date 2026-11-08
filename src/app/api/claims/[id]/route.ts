import { z } from "zod";
import { getLiveClaim } from "@/features/claims/server";
import { createVerifiedReadClient } from "@/lib/server/supabase";
import { apiError, HttpError, privateJson } from "@/lib/server/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(404, "This claim is unavailable or private.");
    const client = await createVerifiedReadClient();
    if (!client) throw new HttpError(503, "Live claims are not available in this preview yet.");
    return privateJson(await getLiveClaim(client, id));
  } catch (error) {
    return apiError(error);
  }
}
