import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseConfig, getSupabaseTrustedConfig } from "./env";

export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookieOptions: { httpOnly: true, sameSite: "lax", path: "/", secure: config.secureCookies },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* Server Components are read-only; the proxy refreshes cookies before rendering. */
        }
      },
    },
  });
}
export type ServerSupabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export function createPublicSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export function createSupabaseTrustedClient() {
  const config = getSupabaseTrustedConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
export async function createVerifiedReadClient() {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  return !error && data.user ? client : createPublicSupabaseClient();
}
