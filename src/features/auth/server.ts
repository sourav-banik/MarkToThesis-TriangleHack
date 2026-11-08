import "server-only";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";
import { profileSchema } from "../profiles/contracts";
import type { AccountState } from "./contracts";

export async function verifiedAccount() {
  const client = await createSupabaseServerClient();
  if (!client) return { client: null, user: null, profile: null };
  // A fresh Auth-server check, never a user ID decoded from an unverified session cookie.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { client, user: null, profile: null };
  const result = await client
    .from("profiles")
    .select("id,handle,display_name,bio")
    .eq("id", data.user.id)
    .maybeSingle();
  if (result.error)
    throw new HttpError(503, "Your account is temporarily unavailable. Please try again later.");
  const profile = result.data
    ? profileSchema.parse({
        id: result.data.id,
        handle: result.data.handle,
        displayName: result.data.display_name,
        bio: result.data.bio,
      })
    : null;
  return { client, user: data.user, profile };
}
export async function requireAccount() {
  const account = await verifiedAccount();
  if (!account.client)
    throw new HttpError(
      503,
      "Accounts are not configured. Connect Supabase to enable live claims.",
    );
  if (!account.user) throw new HttpError(401, "Sign in to continue.");
  return { ...account, client: account.client, user: account.user };
}
export async function accountState(): Promise<AccountState> {
  const account = await verifiedAccount();
  return {
    configured: !!account.client,
    user: account.user ? { id: account.user.id, email: account.user.email ?? null } : null,
    profile: account.profile,
  };
}
