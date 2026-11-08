import { describe, expect, it } from "vitest";
import { commentRequestSchema } from "./contracts";

describe("claim comments", () => {
  it("accepts bounded comment bodies", () => {
    expect(commentRequestSchema.safeParse({ body: "Useful evidence." }).success).toBe(true);
  });
  it("rejects empty, oversized, or extra fields", () => {
    expect(commentRequestSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(commentRequestSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
    expect(commentRequestSchema.safeParse({ body: "ok", authorId: "spoof" }).success).toBe(false);
  });
});
