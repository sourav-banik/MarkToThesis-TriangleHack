import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase is not configured.");
const client = createClient(url, key, { auth: { persistSession: false } });
for (const table of [
  "claims",
  "claim_versions",
  "resolutions",
  "reasoning_reviews",
  "comments",
  "claim_anchors",
]) {
  const result = await client.from(table).select("id").limit(0);
  console.log(
    JSON.stringify({ table, available: !result.error, code: result.error?.code ?? null }),
  );
}
const instruments = await client
  .from("instruments")
  .select("id,live_enabled,provider_binding")
  .eq("live_enabled", true);
console.log(
  JSON.stringify({
    enabledInstruments: instruments.data?.length ?? null,
    allEnabledUseMassive:
      instruments.data?.every((row) => row.provider_binding?.provider === "massive") ?? false,
  }),
);
const baseResponse = await fetch(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  signal: AbortSignal.timeout(15000),
});
const base = await baseResponse.json();
console.log(JSON.stringify({ baseSepoliaReachable: base.result === "0x14a34" }));
