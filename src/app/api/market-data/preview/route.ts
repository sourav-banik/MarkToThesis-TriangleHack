import { requireAccount } from "@/features/auth/server";
import { chartPreviewRequestSchema } from "@/features/market-data/chart-contracts";
import { getPredictionChart } from "@/features/market-data/claim-chart";
import { apiError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireAccount();
    const { terms } = await readJson(request, chartPreviewRequestSchema);
    return privateJson({ configured: true, chart: await getPredictionChart(terms, null) });
  } catch (error) {
    return apiError(error);
  }
}
