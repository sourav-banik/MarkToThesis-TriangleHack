import "server-only";
import { HttpError } from "@/lib/server/http";

const windows = new Map<string, { resetAt: number; count: number; busy: boolean }>();
export function acquireParserSlot(userId: string, now = Date.now()) {
  for (const [id, entry] of windows) if (entry.resetAt <= now && !entry.busy) windows.delete(id);
  let entry = windows.get(userId);
  if (!entry) {
    if (windows.size >= 2000)
      throw new HttpError(503, "Parsing capacity is busy. Try again shortly.");
    entry = { resetAt: now + 60000, count: 0, busy: false };
    windows.set(userId, entry);
  }
  if (entry.busy || entry.count >= 6)
    throw new HttpError(
      429,
      "Please wait before parsing another call. Manual terms remain available.",
    );
  entry.count++;
  entry.busy = true;
  return () => {
    entry.busy = false;
  };
}
