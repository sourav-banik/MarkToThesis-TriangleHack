import { z } from "zod";
import { requireAccount } from "@/features/auth/server";
import { getLiveClaim } from "@/features/claims/server";
import { resolveLiveClaim } from "@/features/resolution/live-service";
import { apiError, HttpError, privateJson, requireSameOrigin } from "@/lib/server/http";
import { createSupabaseTrustedClient } from "@/lib/server/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const account = await requireAccount();
    const record = await getLiveClaim(account.client, id);
    if (record.claim.version.authorId !== account.user.id)
      throw new HttpError(403, "Only the claim owner can trigger its live resolution.");
    const trusted = createSupabaseTrustedClient();
    if (!trusted) throw new HttpError(503, "Trusted Supabase server credentials are not configured.");
    const result = await resolveLiveClaim(trusted, record.claim);
    return privateJson(result);
  } catch (error) {
    return apiError(error);
  }
}
