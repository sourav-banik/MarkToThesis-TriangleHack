"use client";

import { useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AssetMark } from "@/components/ui/asset-mark";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { assetClassLabels, instrumentCatalog } from "../catalog";

export function MarketBrowser() {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const visible = instrumentCatalog.filter((instrument) =>
    `${instrument.symbol} ${instrument.name} ${assetClassLabels[instrument.assetClass]}`
      .toLowerCase()
      .includes(search),
  );
  return (
    <>
      <div className="market-heading">
        <h2>
          Starter instrument catalog{" "}
          <span className="muted small">/ {visible.length} examples</span>
        </h2>
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search instruments</span>
          <input
            placeholder="Search an asset or market"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {visible.length ? (
        <div className="market-grid">
          {visible.map((instrument) => (
            <article className="market-card" key={instrument.id}>
              <div className="claim-card-top">
                <div className="asset-identity">
                  <AssetMark instrument={instrument} />
                  <div>
                    <strong>{instrument.symbol}</strong>
                    <span>{instrument.name}</span>
                  </div>
                </div>
                <Badge>{assetClassLabels[instrument.assetClass]}</Badge>
              </div>
              <p>{instrument.definition}</p>
              <dl>
                <div>
                  <dt>Observation</dt>
                  <dd>{instrument.observation.calendar.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Unit</dt>
                  <dd>
                    {instrument.quote.kind === "yield"
                      ? "Percent yield"
                      : `${instrument.quote.currency} / ${instrument.quote.unit}`}
                  </dd>
                </div>
              </dl>
              <div className="market-card-footer">
                Provider connection pending <ArrowUpRight size={14} aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No matching starter instruments">
          <p>
            The shared model can represent additional listings and series. Live instrument discovery
            is a later increment.
          </p>
        </EmptyState>
      )}
      <div className="inline-note">
        <p>
          <strong>Precise identity before measurement.</strong> A spot price, futures contract, and
          ETF are different instruments. Provider availability and fixing rules must be verified
          before live commitment.
        </p>
        <Link className="text-link" href="/new">
          Explore the formats <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
