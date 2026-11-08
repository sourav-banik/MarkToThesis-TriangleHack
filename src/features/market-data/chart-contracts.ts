import { z } from "zod";
import { commitmentTermsSchema } from "@/features/claims/contracts";

export const chartPointSchema = z.object({ date: z.iso.date(), value: z.number().finite() });
export const claimChartSchema = z.object({
  asset: z.object({ symbol: z.string().min(1), points: z.array(chartPointSchema) }),
  benchmark: z.object({ symbol: z.string().min(1), points: z.array(chartPointSchema) }).nullable(),
  fromDate: z.iso.date(),
  throughDate: z.iso.date(),
  adjustment: z.enum([
    "split_adjusted_price_return_excluding_dividends",
    "unadjusted_quoted_price",
  ]),
  asOf: z.iso.datetime({ offset: true }),
  committedAt: z.iso.datetime({ offset: true }).nullable(),
  terms: commitmentTermsSchema,
});
export const chartPreviewRequestSchema = z.strictObject({ terms: commitmentTermsSchema });
export const claimChartResponseSchema = z.object({
  configured: z.boolean(),
  chart: claimChartSchema.nullable(),
});
export type ClaimChart = z.infer<typeof claimChartSchema>;
