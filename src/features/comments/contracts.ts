import { z } from "zod";
import { profileSchema, type Profile } from "@/features/profiles/contracts";

export const commentBodySchema = z.string().trim().min(1, "Write a comment.").max(2000);
export const commentRequestSchema = z.strictObject({ body: commentBodySchema });
export const commentSchema = z.object({
  id: z.uuid(),
  claimId: z.uuid(),
  author: profileSchema,
  body: commentBodySchema,
  createdAt: z.iso.datetime({ offset: true }),
});
export type Comment = z.infer<typeof commentSchema>;
export type CommentAuthor = Profile;
