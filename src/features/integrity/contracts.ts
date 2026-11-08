import { z } from "zod";

export const transactionHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const anchorSchema = z.object({
  id: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  transaction_hash: transactionHashSchema,
  block_number: z.number().int().nonnegative(),
  block_hash: transactionHashSchema,
  anchored_at: z.iso.datetime({ offset: true }),
  record_kind: z.enum(["commitment", "resolution"]),
});
export type Anchor = z.infer<typeof anchorSchema>;
