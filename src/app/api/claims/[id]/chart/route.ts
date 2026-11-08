import { z } from "zod";
import { getLiveClaim } from "@/features/claims/server";
import { getClaimChart } from "@/features/market-data/claim-chart";
import { apiError, privateJson } from "@/lib/server/http";
import { createVerifiedReadClient } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    z.uuid().parse(id);
    const client = await createVerifiedReadClient();
    if (!client) return privateJson({ configured: false, chart: null });
    const { claim } = await getLiveClaim(client, id);
    return privateJson({ configured: true, chart: await getClaimChart(claim) });
  } catch (error) {
    return apiError(error);
  }
}
