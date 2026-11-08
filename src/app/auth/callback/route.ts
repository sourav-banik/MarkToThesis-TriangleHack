import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { getSupabaseConfig } from "@/lib/server/env";
import { safeReturnPath } from "@/features/auth/contracts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = getSupabaseConfig();
  const client = await createSupabaseServerClient();
  const origin = config?.appOrigin ?? url.origin;
  let path = "/account?confirmation=failed";
  const code = url.searchParams.get("code");
  if (code && client) {
    const result = await client.auth.exchangeCodeForSession(code);
    if (!result.error) path = safeReturnPath(url.searchParams.get("next"));
  }
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Vary", "Cookie");
  return response;
}
