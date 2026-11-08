import "server-only";
import { z } from "zod";
import { getClaudeConfig } from "@/lib/server/env";
import { HttpError } from "@/lib/server/http";
import { extractionJsonSchema, extractionSchema, type ParserRequest } from "./parser-contracts";
import { claimParserPrompt, parserUserContent } from "./prompt";

export async function extractWithClaude(input: ParserRequest, now: string, signal?: AbortSignal) {
  const config = getClaudeConfig();
  if (!config)
    throw new HttpError(
      503,
      "Claude is not connected yet. You can still define the terms manually.",
    );
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 3000,
        system: claimParserPrompt(now),
        messages: [{ role: "user", content: parserUserContent(input) }],
        output_config: { format: { type: "json_schema", schema: extractionJsonSchema() } },
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
        : AbortSignal.timeout(45000),
    });
  } catch (error) {
    if (signal?.aborted) throw new HttpError(499, "The parsing request was cancelled.");
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
      throw new HttpError(504, "Claude took too long. Retry or define the terms manually.");
    throw new HttpError(502, "Claude could not be reached. Retry or define the terms manually.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429)
      throw new HttpError(429, "Claude is busy. Please wait before retrying, or use manual terms.");
    if ([400, 401, 402, 403, 404].includes(response.status))
      throw new HttpError(
        503,
        "The Claude connection needs attention. Check the server API key, billing, and model access. Manual terms remain available.",
      );
    throw new HttpError(
      502,
      "Claude is temporarily unavailable. Your draft has not been saved or changed.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, "Claude returned an empty response.");
  let text = "",
    size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 131072) {
        await reader.cancel();
        throw new Error("oversized");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    const envelope = z
      .object({
        model: z.string().min(1),
        stop_reason: z.string(),
        content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
      })
      .parse(JSON.parse(text));
    if (envelope.stop_reason === "refusal")
      throw new HttpError(
        422,
        "Claude could not structure this text. Rephrase the call or define its terms manually.",
      );
    if (envelope.stop_reason !== "end_turn") throw new Error("incomplete");
    const blocks = envelope.content.filter((item) => item.type === "text");
    if (blocks.length !== 1 || !blocks[0].text) throw new Error("missing text");
    return {
      extraction: extractionSchema.parse(JSON.parse(blocks[0].text)),
      model: envelope.model,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      "Claude returned an incomplete or invalid proposal. Nothing was applied; retry or use manual terms.",
    );
  }
}
