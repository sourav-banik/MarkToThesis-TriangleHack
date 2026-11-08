import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { apiError, HttpError, privateJson, readJson, requireSameOrigin } from "./http";
import { getSupabaseConfig } from "./env";
import { z } from "zod";

afterEach(() => vi.unstubAllEnvs());
describe("server request boundaries", () => {
  it("rejects foreign and absent origins on mutations", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(() =>
      requireSameOrigin(
        new Request("http://localhost:3000/api/claims", {
          headers: { Origin: "https://evil.example" },
        }),
      ),
    ).toThrow(HttpError);
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api/claims"))).toThrow(
      HttpError,
    );
    expect(() =>
      requireSameOrigin(
        new Request("http://localhost:3000/api/claims", {
          headers: { Origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
  it("uses the configured app origin rather than an attacker-controlled host", () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("APP_URL", "https://provenalpha.example");
    expect(() =>
      requireSameOrigin(
        new Request("https://evil.example/api/claims", {
          headers: { Origin: "https://evil.example", Host: "evil.example" },
        }),
      ),
    ).toThrow(HttpError);
  });
  it("accepts the original preview host when Next normalizes its internal URL", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(() =>
      requireSameOrigin(
        new Request("http://localhost:3100/api/claims", {
          headers: { Origin: "http://127.0.0.1:3100", Host: "127.0.0.1:3100" },
        }),
      ),
    ).not.toThrow();
  });
  it("requires an explicit app origin for production accounts", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("APP_URL", "");
    expect(getSupabaseConfig()).toBeNull();
  });
  it("bounds streamed bodies rather than trusting Content-Length", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "1" },
      body: JSON.stringify({ text: "x".repeat(66000) }),
    });
    await expect(readJson(request, z.object({ text: z.string() }))).rejects.toMatchObject({
      status: 413,
    });
  });
  it("reports invalid JSON and unsupported content types", async () => {
    await expect(
      readJson(
        new Request("http://localhost/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "not JSON",
        }),
        z.object({}),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJson(new Request("http://localhost/api", { method: "POST", body: "{}" }), z.object({})),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("marks account responses private and never serializes raw internal errors", async () => {
    const response = privateJson({ ok: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await apiError(new Error("secret database detail")).text()).not.toContain(
      "secret database detail",
    );
  });
  it("rejects privileged credentials instead of silently bypassing row-level security", () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_secret_do_not_use");
    expect(() => getSupabaseConfig()).toThrow("publishable/anon key");
    vi.stubEnv(
      "SUPABASE_PUBLISHABLE_KEY",
      `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
    );
    expect(() => getSupabaseConfig()).toThrow("publishable/anon key");
  });
});
