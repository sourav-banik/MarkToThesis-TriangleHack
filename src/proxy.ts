import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/server/env";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config || !request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-")))
    return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", path: "/", secure: config.secureCookies },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Vary", "Cookie");
  return response;
}
export const config = {
  matcher: [
    "/account/:path*",
    "/auth/:path*",
    "/api/:path*",
    "/new",
    "/profile",
    "/claims/:path*",
    "/u/:path*",
  ],
};
