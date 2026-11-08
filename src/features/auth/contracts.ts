import { z } from "zod";
import { profileSchema } from "../profiles/contracts";

export const credentialsSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(256),
  next: z.string().optional(),
});
export const signupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(80),
});
export const accountStateSchema = z.object({
  configured: z.boolean(),
  user: z.object({ id: z.uuid(), email: z.string().nullable() }).nullable(),
  profile: profileSchema.nullable(),
});
export type AccountState = z.infer<typeof accountStateSchema>;

/** Only known application routes can be an authentication return destination. */
export function safeReturnPath(value: string | null | undefined) {
  if (value === "/new" || value === "/profile" || value === "/account") return value;
  if (
    value &&
    /^\/claims\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    return value;
  return "/profile";
}
