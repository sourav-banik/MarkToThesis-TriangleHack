import type { Metadata } from "next";
import { MarketBrowser } from "@/features/market-data/components/market-browser";

export const metadata: Metadata = { title: "Markets" };

export default function MarketsPage() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">BEYOND A SINGLE MARKET</span>
        <h1>
          Different assets.
          <br />
          <em>Explicit measures.</em>
        </h1>
        <p>
          Stocks, Treasury yields, commodities, crypto, and major markets.
          <br />
          Each with its own units, calendar, and definition.
        </p>
      </div>
      <MarketBrowser />
    </div>
  );
}
