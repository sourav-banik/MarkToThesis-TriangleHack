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
  GEMINI_API_KEY: optionalSecret,
  TWELVE_DATA_API_KEY: optionalSecret,
  FRED_API_KEY: optionalSecret,
});

// No secrets or authenticated sessions are serialized into client configuration.
export function getServerEnv() {
  return serverEnvSchema.parse({
    APP_URL: process.env.APP_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY,
    FRED_API_KEY: process.env.FRED_API_KEY,
  });
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
