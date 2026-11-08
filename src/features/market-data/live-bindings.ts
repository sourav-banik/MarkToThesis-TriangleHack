import { instrumentCatalog, instruments } from "./catalog";
import type { Instrument } from "./contracts";

export type LiveBinding = { provider: string; seriesId: string; fixing: string; version: 1 };

// Identity bindings only. Price retrieval and authoritative schedules arrive in Part 7.
export function liveBindingFor(instrument: Instrument): LiveBinding | null {
  const canonical = instrumentCatalog.find((candidate) => candidate.id === instrument.id);
  if (!canonical || JSON.stringify(canonical) !== JSON.stringify(instrument)) return null;
  if (instrument.assetClass === "stock" || instrument.assetClass === "etf") {
    return {
      provider: "massive",
      seriesId: instrument.symbol,
      fixing: "regular_session_close",
      version: 1,
    };
  }
  if (instrument.id === instruments.treasury5y.id || instrument.id === instruments.treasury10y.id) {
    return {
      provider: "fred",
      seriesId: instrument.id === instruments.treasury5y.id ? "DGS5" : "DGS10",
      fixing: "h15_dated_observation",
      version: 1,
    };
  }
  if (instrument.id === instruments.wti.id)
    return {
      provider: "fred",
      seriesId: "DCOILWTICO",
      fixing: "dated_spot_observation",
      version: 1,
    };
  // Spot/crypto/FX reference providers must be chosen explicitly, never silently substituted.
  return null;
}
