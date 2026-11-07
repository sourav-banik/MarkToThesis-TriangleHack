import { z } from "zod";

export const profileSchema = z.object({
  id: z.string().min(1),
  handle: z.string().regex(/^[a-z0-9_]{3,30}$/),
  displayName: z.string().min(1),
  bio: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;
