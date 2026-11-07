import { Bitcoin, CircleDollarSign, Droplets, Landmark, Layers3, Sparkles } from "lucide-react";
import type { Instrument } from "@/features/market-data/contracts";

export function AssetMark({ instrument }: { instrument: Instrument }) {
  const Icon =
    instrument.assetClass === "sovereign_yield"
      ? Landmark
      : instrument.assetClass === "crypto"
        ? Bitcoin
        : instrument.assetClass === "commodity"
          ? instrument.symbol === "WTI"
            ? Droplets
            : Sparkles
          : instrument.assetClass === "fx"
            ? CircleDollarSign
            : Layers3;
  return (
    <span className={`asset-mark asset-${instrument.assetClass}`}>
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}
