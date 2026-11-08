import { z } from "zod";

export const chartPointSchema = z.object({ date: z.iso.date(), value: z.number().finite() });
export const claimChartSchema = z.object({
  asset: z.object({ symbol: z.string().min(1), points: z.array(chartPointSchema) }),
  benchmark: z.object({ symbol: z.string().min(1), points: z.array(chartPointSchema) }).nullable(),
  fromDate: z.iso.date(),
  throughDate: z.iso.date(),
  adjustment: z.literal("split_adjusted_price_return_excluding_dividends"),
});
export const claimChartResponseSchema = z.object({ configured: z.boolean(), chart: claimChartSchema.nullable() });
export type ClaimChart = z.infer<typeof claimChartSchema>;
