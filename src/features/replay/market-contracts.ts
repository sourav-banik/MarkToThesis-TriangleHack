import { z } from "zod";
import { commitmentTermsSchema, committedClaimVersionSchema } from "@/features/claims/contracts";
import { liveBindingFor } from "@/features/market-data/live-bindings";
export const marketReplayRequestSchema = z
  .strictObject({
    originalText: z.string().trim().min(1).max(8000),
    terms: commitmentTermsSchema,
    simulatedDate: z.iso.date(),
  })
  .superRefine((request, context) => {
    const prediction = request.terms.prediction;
    const assets = [
      request.terms.instrument,
      ...(prediction.kind === "outperform" || prediction.kind === "underperform"
        ? [prediction.benchmark]
        : []),
    ];
    if (assets.some((asset) => liveBindingFor(asset)?.provider !== "massive"))
      context.addIssue({
        code: "custom",
        message: "This replay supports the listed U.S. stocks and ETFs only.",
      });
  });
export const marketReplayClaimSchema = committedClaimVersionSchema;
