import { z } from "zod";
import { persistedClaimSchema } from "@/features/claims/live-contracts";
import { profileSchema } from "@/features/profiles/contracts";
import { instrumentCatalog } from "@/features/market-data/catalog";

export const feedCursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export const feedFiltersSchema = z.object({
  q: z.string().trim().max(120).default(""),
  kind: z.enum(["all", "outperform", "underperform", "hold", "range"]).default("all"),
  instrumentId: z
    .string()
    .refine(
      (id) => id === "all" || instrumentCatalog.some((item) => item.id === id),
      "Choose a supported instrument.",
    )
    .default("all"),
  status: z.enum(["all", "awaiting_start", "unscored"]).default("all"),
  horizon: z.enum(["all", "days", "months", "years", "date"]).default("all"),
  visibility: z.enum(["all", "public", "private"]).default("all"),
});
export const defaultFeedFilters = feedFiltersSchema.parse({});
export const feedRequestSchema = z.object({
  filters: feedFiltersSchema,
  cursor: feedCursorSchema.nullable(),
});
export function parseFeedQuery(params: URLSearchParams) {
  const time = params.get("beforeTime"),
    id = params.get("beforeId");
  return feedRequestSchema.safeParse({
    filters: Object.fromEntries(
      Object.keys(defaultFeedFilters).map((key) => [key, params.get(key) ?? undefined]),
    ),
    cursor: time !== null || id !== null ? { createdAt: time, id } : null,
  });
}
export function writeFeedFilters(params: URLSearchParams, filters: FeedFilters) {
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== "all") params.set(key, value);
    else params.delete(key);
  }
}
// PostgREST imatch supports literal substring search without LIKE's '*' alias.
// Escape all regex syntax so users cannot submit an expensive custom expression.
export function literalSearchPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export const feedRecordSchema = persistedClaimSchema.extend({ author: profileSchema });
export const recordSummarySchema = z.object({
  awaitingStart: z.number().int().nonnegative(),
  unscored: z.number().int().nonnegative(),
});
export const feedPageSchema = z.object({
  configured: z.boolean(),
  claims: z.array(feedRecordSchema),
  nextCursor: feedCursorSchema.nullable(),
  summary: recordSummarySchema.nullable(),
});
export type FeedFilters = z.infer<typeof feedFiltersSchema>;
export type FeedCursor = z.infer<typeof feedCursorSchema>;
export type FeedRecord = z.infer<typeof feedRecordSchema>;
export type RecordSummary = z.infer<typeof recordSummarySchema>;
