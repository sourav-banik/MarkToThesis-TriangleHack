import { safeReturnPath, signupSchema } from "@/features/auth/contracts";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { getSupabaseConfig } from "@/lib/server/env";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const config = getSupabaseConfig();
    const client = await createSupabaseServerClient();
    if (!config || !client)
      throw new HttpError(503, "Accounts are not available in this preview yet.");
    const body = await readJson(request, signupSchema);
    const next = safeReturnPath(body.next);
    const redirect = new URL("/auth/callback", config.appOrigin);
    redirect.searchParams.set("next", next);
    const { data, error } = await client.auth.signUp({
      email: body.email,
      password: body.password,
      options: { data: { display_name: body.displayName }, emailRedirectTo: redirect.toString() },
    });
    if (error)
      throw new HttpError(
        400,
        "An account could not be created. Check your details or try signing in.",
      );
    return privateJson(
      data.session
        ? { next }
        : {
            message:
              "If this address can register, check your email to confirm the account, then return to sign in.",
          },
    );
  } catch (error) {
    return apiError(error);
  }
}
