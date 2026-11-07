import "server-only";
import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  SUPABASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
  SUPABASE_PUBLISHABLE_KEY: optionalSecret,
  GEMINI_API_KEY: optionalSecret,
  TWELVE_DATA_API_KEY: optionalSecret,
  FRED_API_KEY: optionalSecret,
});

// Called only by server modules. No provider is connected in Part 1.
export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY,
    FRED_API_KEY: process.env.FRED_API_KEY,
  });
}
