import "server-only";
import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  APP_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ protocol: /^https?$/ }).optional(),
  ),
  SUPABASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ protocol: /^https?$/ }).optional(),
  ),
  SUPABASE_PUBLISHABLE_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .min(1)
      .refine((key) => {
        if (key.startsWith("sb_secret_")) return false;
        const payload = key.split(".")[1];
        if (payload) {
          try {
            return JSON.parse(Buffer.from(payload, "base64url").toString()).role === "anon";
          } catch {
            return false;
          }
        }
        return key.startsWith("sb_publishable_");
      }, "Use a Supabase publishable/anon key, never a privileged secret or service-role key.")
      .optional(),
  ),
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^claude-[a-z0-9-]+$/)
      .optional(),
  ),
  TWELVE_DATA_API_KEY: optionalSecret,
  FRED_API_KEY: optionalSecret,
  MASSIVE_API_KEY: optionalSecret,
  SUPABASE_SECRET_KEY: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
});

// No secrets or authenticated sessions are serialized into client configuration.
export function getServerEnv() {
  return serverEnvSchema.parse({
    APP_URL: process.env.APP_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY,
    FRED_API_KEY: process.env.FRED_API_KEY,
    MASSIVE_API_KEY: process.env.MASSIVE_API_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function getMassiveConfig() {
  const key = getServerEnv().MASSIVE_API_KEY;
  return key ? { apiKey: key, baseUrl: "https://api.massive.com" } : null;
}

export function getSupabaseTrustedConfig() {
  const env = getServerEnv();
  if (env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SECRET_KEY !== env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("SUPABASE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY must match when both are set.");
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) return null;
  if (key.startsWith("sb_publishable_")) throw new Error("A publishable Supabase key cannot be used for trusted writes.");
  if (key.startsWith("sb_secret_")) return { url: env.SUPABASE_URL, key };
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()) as { role?: string };
    if (payload.role !== "service_role") throw new Error("not service role");
  } catch {
    throw new Error("Use a Supabase secret key or legacy service-role key for trusted writes.");
  }
  return { url: env.SUPABASE_URL, key };
}

export function getClaudeConfig() {
  const env = getServerEnv();
  return env.ANTHROPIC_API_KEY
    ? { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001" }
    : null;
}

export function getSupabaseConfig() {
  const env = getServerEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  if (process.env.NODE_ENV === "production" && !env.APP_URL) return null;
  const appUrl = new URL(env.APP_URL ?? "http://localhost:3000");
  return {
    url: env.SUPABASE_URL,
    key: env.SUPABASE_PUBLISHABLE_KEY,
    appOrigin: appUrl.origin,
    secureCookies: appUrl.protocol === "https:",
  };
}
