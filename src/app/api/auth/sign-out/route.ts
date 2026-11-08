import { createSupabaseServerClient } from "@/lib/server/supabase";
import { apiError, HttpError, privateJson, requireSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const client = await createSupabaseServerClient();
    if (!client) throw new HttpError(503, "Accounts are not available in this preview yet.");
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new HttpError(503, "Sign out could not be completed. Please retry.");
    return privateJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
