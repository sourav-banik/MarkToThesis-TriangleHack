import { writeFileSync } from "node:fs";
import { instrumentCatalog } from "../src/features/market-data/catalog";
import { liveBindingFor } from "../src/features/market-data/live-bindings";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const rows = instrumentCatalog.map((instrument) => {
  const binding = liveBindingFor(instrument);
  return `(${quote(instrument.id)}, ${quote(JSON.stringify(instrument))}::jsonb, ${binding ? "true" : "false"}, ${binding ? quote(JSON.stringify(binding)) + "::jsonb" : "null"})`;
});
writeFileSync(
  new URL("../supabase/migrations/202611070002_instrument_seed.sql", import.meta.url),
  "-- Generated from the canonical TypeScript instrument catalog. No prices or credentials.\n" +
    "insert into public.instruments(id, definition, live_enabled, provider_binding) values\n" +
    rows.join(",\n") +
    ";\n",
);
