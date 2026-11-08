import { requireAccount } from "@/features/auth/server";
import { extractWithClaude } from "@/features/ai/claude";
import { normalizeExtraction } from "@/features/ai/normalize";
import { parserRequestSchema } from "@/features/ai/parser-contracts";
import { acquireParserSlot } from "@/features/ai/limits";
import { getClaudeConfig } from "@/lib/server/env";
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    return privateJson({ configured: !!getClaudeConfig(), provider: "anthropic" });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    requireSameOrigin(request);
    const account = await requireAccount();
    const input = await readJson(request, parserRequestSchema);
    if (!getClaudeConfig())
      throw new HttpError(503, "Claude is not connected yet. Define the terms manually for now.");
    release = acquireParserSlot(account.user.id);
    const now = new Date().toISOString();
    const { extraction, model } = await extractWithClaude(input, now, request.signal);
    return privateJson(
      normalizeExtraction(extraction, input, { id: crypto.randomUUID(), model, now }),
    );
  } catch (error) {
    return apiError(error);
  } finally {
    release?.();
  }
}
