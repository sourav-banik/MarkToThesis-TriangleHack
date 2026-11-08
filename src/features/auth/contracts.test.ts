import { describe, expect, it } from "vitest";
import { credentialsSchema, safeReturnPath, signupSchema } from "./contracts";
import { profileUpdateSchema } from "../profiles/contracts";

describe("account boundaries", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "javascript:alert(1)",
    "/account?next=https://evil.example",
  ])("rejects unsafe return destination %s", (path) => {
    expect(safeReturnPath(path)).toBe("/profile");
  });
  it("preserves allowed internal return destinations", () => {
    expect(safeReturnPath("/new")).toBe("/new");
    expect(safeReturnPath("/claims/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
      "/claims/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });
  it("validates signup details and does not accept privileged account fields", () => {
    expect(
      signupSchema.safeParse({
        email: "investor@example.test",
        password: "a-long-test-password",
        displayName: "Investor",
      }).success,
    ).toBe(true);
    expect(credentialsSchema.safeParse({ email: "bad", password: "short" }).success).toBe(false);
    expect(
      signupSchema.safeParse({
        email: "investor@example.test",
        password: "a-long-test-password",
        displayName: "Investor",
        role: "admin",
      }).success,
    ).toBe(false);
  });
  it("allows only public profile fields to be edited", () => {
    const profile = { displayName: "Investor", handle: "investor_1", bio: "Public bio" };
    expect(profileUpdateSchema.safeParse(profile).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ ...profile, id: "another-user" }).success).toBe(false);
    expect(
      profileUpdateSchema.safeParse({ ...profile, email: "private@example.test" }).success,
    ).toBe(false);
  });
});
