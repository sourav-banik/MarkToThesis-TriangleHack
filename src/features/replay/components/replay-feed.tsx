"use client";

import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useReplayStore } from "../store";
import { ReplayRecordCard } from "./replay-record-card";

export function ReplayFeed() {
  const state = useReplayStore();
  const records = state
    ? [
        ...state.records.filter((record) => record.origin === "browser"),
        ...state.records.filter((record) => record.origin === "preloaded").slice(0, 2),
      ]
    : [];
  return (
    <section className="replay-feed" aria-labelledby="replay-feed-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE COMPLETE LOOP</span>
          <h2 id="replay-feed-title">Try a synthetic replay</h2>
          <p className="replay-feed-description">
            Confirm a call, inspect a code-calculated outcome, and keep the misses in view. Prices
            are fabricated.
          </p>
        </div>
        <Link href="/replay" className={buttonClass()}>
          <Play size={14} aria-hidden="true" />
          Start replay
        </Link>
      </div>
      {state ? (
        <div className="replay-record-grid">
          {records.map((record) => (
            <ReplayRecordCard record={record} key={record.claim.claimId} />
          ))}
        </div>
      ) : (
        <p role="status" className="replay-loading">
          Loading replay examples…
        </p>
      )}
      <Link href="/profile?record=demo" className="text-link replay-history-link">
        View the fictional author’s full history <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}
