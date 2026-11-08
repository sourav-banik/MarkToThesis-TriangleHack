import { accountState, requireAccount } from "@/features/auth/server";
import { profileUpdateSchema } from "@/features/profiles/contracts";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";

export async function GET() {
  try {
    return privateJson(await accountState());
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await requireAccount();
    const body = await readJson(request, profileUpdateSchema);
    const result = await account.client
      .from("profiles")
      .update({ handle: body.handle, display_name: body.displayName, bio: body.bio })
      .eq("id", account.user.id)
      .select("id")
      .single();
    if (result.error?.code === "23505") throw new HttpError(409, "That handle is already in use.");
    if (result.error) throw new HttpError(503, "Your profile could not be updated.");
    return privateJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
