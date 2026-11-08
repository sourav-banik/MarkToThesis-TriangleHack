import { z } from "zod";
import {
  horizonSchema,
  commitmentTermsSchema,
  missingFieldSchema,
} from "@/features/claims/contracts";
import { instrumentCatalog } from "@/features/market-data/catalog";
import { parseClaimResultSchema } from "./contracts";

export const parserRequestSchema = z.strictObject({
  originalText: z.string().trim().min(1).max(8000),
  rationale: z.string().max(8000).default(""),
  clarifications: z
    .array(
      z.strictObject({
        field: missingFieldSchema,
        question: z.string().min(1).max(600),
        answer: z.string().trim().min(1).max(2000),
      }),
    )
    .max(16)
    .default([]),
});
const nullableField = <T extends z.ZodType>(schema: T) =>
  z.strictObject({ value: schema.nullable(), quote: z.string().max(8000) });
const instrumentIds = instrumentCatalog.map((item) => item.id) as [string, ...string[]];
export const extractionSchema = z.strictObject({
  instrumentId: nullableField(z.enum(instrumentIds)),
  kind: nullableField(z.enum(["outperform", "underperform", "hold", "range"])),
  benchmarkId: nullableField(z.enum(instrumentIds)),
  horizon: nullableField(horizonSchema),
  holdMeaning: nullableField(z.enum(["neutral", "maintain_position"])),
  tolerance: nullableField(z.number().positive()),
  lower: nullableField(z.number()),
  upper: nullableField(z.number()),
  metric: nullableField(z.enum(["quoted_value", "price_return_pct", "yield_change_bps"])),
  evaluation: nullableField(z.enum(["at_review", "every_daily_observation"])),
  confidencePct: nullableField(z.number().min(0).max(100)),
  rationale: nullableField(z.string().min(1).max(8000)),
  // Only text already supplied by the author. Never generate an investment thesis.
  assumptions: z
    .array(
      z.strictObject({
        statement: z.string().min(1).max(2000),
        falsificationCondition: z.string().min(1).max(2000),
        quote: z.string().min(1).max(8000),
      }),
    )
    .max(20),
  ambiguities: z
    .array(z.strictObject({ field: missingFieldSchema, question: z.string().min(1).max(600) }))
    .max(8),
});
export const parserResponseSchema = parseClaimResultSchema
  .extend({
    terms: commitmentTermsSchema.nullable(),
    ready: z.boolean(),
    warnings: z.array(z.string()),
  })
  .superRefine((response, context) => {
    if (
      response.ready !==
      (response.terms !== null &&
        response.draft.missingFields.length === 0 &&
        response.draft.clarificationQuestions.length === 0)
    )
      context.addIssue({
        code: "custom",
        message: "A ready proposal must have complete validated terms and no unanswered questions.",
      });
  });
export type ParserRequest = z.infer<typeof parserRequestSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type ParserResponse = z.infer<typeof parserResponseSchema>;

// Claude accepts a subset of JSON Schema. Runtime validation keeps the stricter limits.
export function extractionJsonSchema() {
  const schema = z.toJSONSchema(extractionSchema);
  function simplify(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(simplify);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              "$schema",
              "minimum",
              "maximum",
              "exclusiveMinimum",
              "minLength",
              "maxLength",
              "minItems",
              "maxItems",
              "format",
              "pattern",
            ].includes(key),
        )
        .map(([key, item]) => [key === "oneOf" ? "anyOf" : key, simplify(item)]),
    );
  }
  return simplify(schema);
}
