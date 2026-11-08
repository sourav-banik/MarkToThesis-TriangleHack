import { z } from "zod";

export const profileSchema = z.object({
  id: z.string().min(1),
  handle: z.string().regex(/^[a-z0-9_]{3,40}$/),
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().max(500),
});

export const profileUpdateSchema = profileSchema.omit({ id: true }).strict();

export type Profile = z.infer<typeof profileSchema>;
