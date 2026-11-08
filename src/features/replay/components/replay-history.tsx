"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REPLAY_AUTHOR } from "../dataset";
import { replayCounts } from "../presentation";
import { useReplayStore } from "../store";
import { ReplayNotice } from "./replay-notice";
import { ReplayRecordCard } from "./replay-record-card";
import { LiveClaimList } from "@/features/claims/components/live-claim-list";

export function ReplayHistory({ initialTab = "demo" }: { initialTab?: "demo" | "live" }) {
  const state = useReplayStore();
  const [tab, setTab] = useState<"demo" | "live">(initialTab);
  return (
    <>
      <div className="filter-tabs profile-tabs" role="group" aria-label="Record type">
        <button
          aria-pressed={tab === "demo"}
          className={tab === "demo" ? "selected" : ""}
          onClick={() => setTab("demo")}
        >
          Demo author history
        </button>
        <button
          aria-pressed={tab === "live"}
          className={tab === "live" ? "selected" : ""}
          onClick={() => setTab("live")}
        >
          Your live record
        </button>
      </div>
      {tab === "live" ? (
        <section className="live-history">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR DATABASE RECORDS</span>
              <h2>Public and private calls</h2>
            </div>
          </div>
          <LiveClaimList scope="mine" />
        </section>
      ) : (
        <>
          <ReplayNotice />
          <section className="profile-panel">
            <div className="profile-heading">
              <span className="profile-avatar">
                <UserRound size={26} aria-hidden="true" />
              </span>
              <div>
                <h2>{REPLAY_AUTHOR.displayName}</h2>
                <p>@{REPLAY_AUTHOR.handle} · Fictional demo author · synthetic outcomes only</p>
              </div>
              <Badge tone="purple">Demo history</Badge>
            </div>
            {state ? (
              <>
                <div className="profile-metrics replay-profile-metrics">
                  {Object.entries(replayCounts(state.records)).map(([label, count]) => (
                    <div key={label}>
                      <span>
                        {label === "not_met"
                          ? "Not met"
                          : label === "met"
                            ? "Met"
                            : label === "unclear"
                              ? "Unclear"
                              : label === "pending"
                                ? "Pending / ready"
                                : "Unscored"}
                      </span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
                <div className="history-body">
                  <div className="section-heading">
                    <h3>The full synthetic history</h3>
                    <span className="small muted">
                      {state.records.length} examples · misses remain visible
                    </span>
                  </div>
                  {state.notice && (
                    <div role="status" className="form-message error">
                      {state.notice}
                    </div>
                  )}
                  <div className="replay-record-grid">
                    {state.records.map((record) => (
                      <ReplayRecordCard key={record.claim.claimId} record={record} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p role="status" className="replay-loading">
                Loading synthetic history…
              </p>
            )}
          </section>
          <div className="inline-note">
            <p>
              <strong>Prospective public statistics: none.</strong> These synthetic examples
              demonstrate the interface and resolver. They are excluded from any live record and do
              not establish investing skill.
            </p>
            <Link href="/replay" className="text-link">
              Add a tab-local replay <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </>
  );
}
