"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { ClaimExample } from "@/demo/claims";
import { ClaimSummary } from "@/features/claims/components/claim-summary";
import { EmptyState } from "@/components/ui/empty-state";

const filters = ["all", "outperform", "underperform", "hold", "range"] as const;
const labels = {
  all: "All claims",
  outperform: "Outperform",
  underperform: "Underperform",
  hold: "Hold",
  range: "Range",
};

export function ExampleFeed({ examples }: { examples: ClaimExample[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const visible = examples.filter(
    (example) =>
      (filter === "all" || example.terms.prediction.kind === filter) &&
      `${example.originalText} ${example.terms.instrument.symbol} ${example.terms.instrument.name}`
        .toLowerCase()
        .includes(search),
  );
  return (
    <section aria-labelledby="feed-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">IDEAS, WITH TERMS</span>
          <h2 id="feed-title">Explore the claim formats</h2>
        </div>
        <span className="small muted">{visible.length} illustrative examples</span>
      </div>
      <div className="feed-toolbar">
        <div className="filter-tabs" role="group" aria-label="Filter by claim type">
          {filters.map((value) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {labels[value]}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search claim examples</span>
          <input
            placeholder="Search assets or claims"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="feed-note">
        <SlidersHorizontal size={14} aria-hidden="true" />
        Same accountability. Different ways to make a call.
      </div>
      {visible.length ? (
        <div className="claim-grid">
          {visible.map((example) => (
            <ClaimSummary
              key={example.id}
              terms={example.terms}
              originalText={example.originalText}
              href={`/claims/${example.id}`}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No matching examples">
          <p>Try another asset or claim type.</p>
        </EmptyState>
      )}
    </section>
  );
}
