import "server-only";
import { z } from "zod";
import { getSupabaseConfig } from "./env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireSameOrigin(request: Request) {
  const config = getSupabaseConfig();
  const previewUrl = new URL(request.url);
  // Next may normalize its internal hostname. This fallback is preview-only: without
  // configuration, authenticated mutations cannot run. Configured apps trust APP_URL.
  if (!config && request.headers.get("host")) previewUrl.host = request.headers.get("host")!;
  const expected = config?.appOrigin ?? previewUrl.origin;
  if (request.headers.get("origin") !== expected)
    throw new HttpError(403, "This action must come from the ProvenAlpha app.");
}
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new HttpError(413, "The request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "The JSON request is invalid.");
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new HttpError(400, result.error.issues.map((issue) => issue.message).join(" "));
  return result.data;
}
export function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Vary: "Cookie",
      Expires: "0",
      Pragma: "no-cache",
    },
  });
}
export function apiError(error: unknown) {
  return error instanceof HttpError
    ? privateJson({ error: error.message }, error.status)
    : privateJson({ error: "The request could not be completed. Please try again." }, 500);
}
