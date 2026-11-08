"use client";

import { useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { instrumentCatalog } from "@/features/market-data/catalog";
import { defaultFeedFilters, feedFiltersSchema, type FeedFilters } from "../contracts";

export function FeedFiltersForm({
  mine,
  onApply,
}: {
  mine: boolean;
  onApply: (filters: FeedFilters) => void;
}) {
  const [draft, setDraft] = useState(defaultFeedFilters);
  function field(key: keyof FeedFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return (
    <form
      className="live-filter-panel"
      aria-label="Filter live claims"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(feedFiltersSchema.parse(draft));
      }}
    >
      <label className="live-search">
        <span>Search original calls</span>
        <div>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            maxLength={120}
            value={draft.q}
            onChange={(event) => field("q", event.target.value)}
            placeholder="Words from the original call"
          />
        </div>
      </label>
      <label>
        <span>Claim type</span>
        <select
          aria-label="Claim type"
          value={draft.kind}
          onChange={(event) => field("kind", event.target.value)}
        >
          <option value="all">All claim types</option>
          <option value="outperform">Outperform</option>
          <option value="underperform">Underperform</option>
          <option value="hold">Hold</option>
          <option value="range">Range</option>
        </select>
      </label>
      <label>
        <span>Asset</span>
        <select
          aria-label="Asset"
          value={draft.instrumentId}
          onChange={(event) => field("instrumentId", event.target.value)}
        >
          <option value="all">All assets</option>
          {instrumentCatalog.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.symbol} · {asset.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Claim status</span>
        <select
          aria-label="Claim status"
          value={draft.status}
          onChange={(event) => field("status", event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="awaiting_start">Awaiting data</option>
          <option value="unscored">Unscored stance</option>
        </select>
      </label>
      <label>
        <span>Horizon unit</span>
        <select
          aria-label="Horizon unit"
          value={draft.horizon}
          onChange={(event) => field("horizon", event.target.value)}
        >
          <option value="all">All horizons</option>
          <option value="days">Days</option>
          <option value="months">Months</option>
          <option value="years">Years</option>
          <option value="date">Target date</option>
        </select>
      </label>
      {mine && (
        <label>
          <span>Claim visibility</span>
          <select
            aria-label="Claim visibility"
            value={draft.visibility}
            onChange={(event) => field("visibility", event.target.value)}
          >
            <option value="all">Public and private</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
      )}
      <div className="live-filter-actions">
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={() => {
            setDraft(defaultFeedFilters);
            onApply(defaultFeedFilters);
          }}
        >
          <RotateCcw size={13} aria-hidden="true" />
          Reset
        </Button>
      </div>
    </form>
  );
}
