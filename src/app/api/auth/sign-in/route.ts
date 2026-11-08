import { credentialsSchema, safeReturnPath } from "@/features/auth/contracts";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const client = await createSupabaseServerClient();
    if (!client) throw new HttpError(503, "Accounts are not available in this preview yet.");
    const body = await readJson(request, credentialsSchema);
    const result = await client.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (result.error || !result.data.user)
      throw new HttpError(
        400,
        "Email or password was not accepted. Check whether your email needs confirmation.",
      );
    return privateJson({ next: safeReturnPath(body.next) });
  } catch (error) {
    return apiError(error);
  }
}
