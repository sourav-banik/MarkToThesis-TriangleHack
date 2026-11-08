"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, LockKeyhole, Play, UserRound } from "lucide-react";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { describePrediction, formatHorizon } from "@/features/claims/presentation";
import { evaluateReplay, REPLAY_AUTHOR } from "../dataset";
import { runReplay, useReplayStore } from "../store";
import { formatReplayTime } from "../presentation";
import { ReplayNotice } from "./replay-notice";
import { ReplayResult } from "./replay-result";

export function ReplayDetail({ id }: { id: string }) {
  const state = useReplayStore();
  const [error, setError] = useState<string | null>(null);
  if (!state)
    return (
      <div role="status" className="replay-loading">
        Opening this tab’s replay…
      </div>
    );
  const record = state.records.find((item) => item.claim.claimId === id);
  if (!record)
    return (
      <>
        <ReplayNotice />
        <EmptyState
          title="This replay is not available in this tab"
          action={
            <Link href="/replay" className={buttonClass()}>
              Start a new replay
            </Link>
          }
        >
          <p>
            New replays are tab-local previews, not public share links. Preloaded examples are
            available in the demo author’s history.
          </p>
        </EmptyState>
      </>
    );
  const claim = record.claim;
  const attempt = evaluateReplay(record);
  return (
    <>
      <Link href="/" className="back-link">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the feed
      </Link>
      <ReplayNotice />
      {state.notice && (
        <div role="status" className="form-message error">
          {state.notice}
        </div>
      )}
      <div className="page-heading">
        <span className="eyebrow">
          {record.origin === "browser" ? "CONFIRMED IN THIS TAB" : "PRELOADED SYNTHETIC EXAMPLE"}
        </span>
        <h1>
          The terms stay.
          <br />
          <em>The outcome follows.</em>
        </h1>
        <p>Inspect the original wording, the saved test, and the inputs used to measure it.</p>
      </div>
      <div className="replay-detail-grid">
        <section className="detail-panel locked-claim">
          <div className="section-heading">
            <span className="eyebrow">ORIGINAL WORDING · VERSION {claim.version}</span>
            <Badge tone="purple">
              <LockKeyhole size={11} aria-hidden="true" /> Locked replay copy
            </Badge>
          </div>
          <blockquote className="original-call">{claim.originalText}</blockquote>
          <p className="locked-condition">
            {claim.terms.instrument.symbol}: {describePrediction(claim.terms)}
          </p>
          <dl className="detail-list">
            <div>
              <dt>Horizon</dt>
              <dd>{formatHorizon(claim.terms.horizon)}</dd>
            </div>
            <div>
              <dt>
                {record.origin === "browser"
                  ? "Browser confirmation time"
                  : "Preloaded fixture confirmation time"}
              </dt>
              <dd>
                {formatReplayTime(claim.committedAt)}
                <small>
                  {record.origin === "browser"
                    ? "Browser clock only. No server-verified timestamp or public publication."
                    : "Fixed example metadata; not a historical prediction timestamp."}
                </small>
              </dd>
            </div>
            <div>
              <dt>Simulated market start</dt>
              <dd>
                {claim.context.kind === "replay"
                  ? formatReplayTime(claim.context.simulatedCommitmentAt)
                  : "—"}
                <small>
                  Separate from confirmation. Prices and dates are synthetic replay inputs.
                </small>
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>
                {claim.terms.confidencePct === null ? "Unstated" : `${claim.terms.confidencePct}%`}
              </dd>
            </div>
          </dl>
          {!attempt && (
            <div className="resolve-action">
              <p>
                The terms are locked. Run the deterministic calculation against this synthetic
                dataset.
              </p>
              <Button
                onClick={() => {
                  try {
                    runReplay(id);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "The replay could not run.");
                  }
                }}
              >
                <Play size={15} aria-hidden="true" />
                Run resolution
              </Button>
            </div>
          )}
          {error && (
            <div role="alert" className="form-message error">
              {error}
            </div>
          )}
        </section>
        <aside className="replay-context">
          <div className="aside-card">
            <UserRound size={23} className="purple-text" aria-hidden="true" />
            <h2>{REPLAY_AUTHOR.displayName}</h2>
            <p className="replay-coverage-note">
              Fictional demo author · @{REPLAY_AUTHOR.handle}. This replay appears beside synthetic
              wins, misses, pending calls, and unscored holds.
            </p>
            <Link href="/profile?record=demo" className="text-link">
              Open demo author history <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="aside-footnote">
            <span className="eyebrow">ORIGINAL TERMS REMAIN VISIBLE</span>
            <p>
              To explore a different call, start a separate replay. Results never rewrite this
              copy’s original wording, confidence, rationale, or conditions.
            </p>
            <Link href="/replay" className="text-link">
              Start another replay <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
      {attempt && <ReplayResult attempt={attempt} />}
      <section className="detail-panel replay-reasoning">
        <span className="eyebrow">REASONING IS SEPARATE FROM THE SCORE</span>
        <h2>The author’s stated reasoning</h2>
        <p>{claim.terms.rationale || "No rationale was supplied for this replay."}</p>
        {claim.terms.assumptions.map((assumption) => (
          <div className="assumption" key={assumption.id}>
            <strong>{assumption.statement}</strong>
            <p>What would change this view: {assumption.falsificationCondition}</p>
          </div>
        ))}
        <div className="result-caveat">
          <Info size={16} aria-hidden="true" />
          <span>
            This is the original rationale, not an AI evidence review. The numerical outcome does
            not validate or establish the cause of the author’s thesis.
          </span>
        </div>
      </section>
    </>
  );
}
