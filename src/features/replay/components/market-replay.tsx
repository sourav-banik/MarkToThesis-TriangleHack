"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClaudeAssistant } from "@/features/ai/components/claude-assistant";
import { ClaimWorkbench } from "@/features/claims/components/claim-workbench";
import type { ConfirmedTerms } from "@/features/claims/contracts";
import type { ResolutionAttempt } from "@/features/resolution/contracts";
import { describePrediction, formatHorizon } from "@/features/claims/presentation";
import { ReplayResult } from "./replay-result";
import { useAccount } from "@/features/auth/use-account";

export function MarketReplay() {
  const { account } = useAccount();
  const [original, setOriginal] = useState("Apple should do better than the market.");
  const [rationale, setRationale] = useState("");
  const [date, setDate] = useState("2026-09-01");
  const [terms, setTerms] = useState<ConfirmedTerms | null>(null);
  const [review, setReview] = useState<ConfirmedTerms | null>(null);
  const [result, setResult] = useState<{
    attempt: ResolutionAttempt;
    recordedAt: string;
    explanation: {
      summary: string;
      sources: { id: string; url: string; symbol: string; date: string }[];
    } | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!account) return <p role="status">Checking account…</p>;
  if (!account.user)
    return (
      <p>
        <Link className="text-link" href="/account?next=/demo">
          Sign in to run a replay with Massive prices and Claude.
        </Link>
      </p>
    );
  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/replay/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalText: original, terms: review, simulatedDate: date }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="live-record-notice">
        <strong>Historical replay · real Massive prices</strong>
        <p>
          This call is entered now and evaluated over a simulated historical window. It is excluded
          from public claims, live statistics, and blockchain history.
        </p>
      </div>
      {!review && !result && (
        <>
          <section className="form-panel">
            <h2>1. Write and clarify a call</h2>
            <div className="field-group">
              <label htmlFor="replay-original">Original call</label>
              <textarea
                id="replay-original"
                value={original}
                onChange={(event) => {
                  setOriginal(event.target.value);
                  setTerms(null);
                }}
                maxLength={8000}
              />
            </div>
            <div className="field-group">
              <label htmlFor="replay-reason">Reasoning</label>
              <textarea
                id="replay-reason"
                value={rationale}
                onChange={(event) => {
                  setRationale(event.target.value);
                  setTerms(null);
                }}
                maxLength={8000}
              />
            </div>
            <div className="field-group">
              <label htmlFor="replay-date">Simulated logging date (historical)</label>
              <input
                id="replay-date"
                type="date"
                min="2024-01-01"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </section>
          <ClaudeAssistant originalText={original} rationale={rationale} onApply={setTerms} />
          {terms && (
            <>
              <h2>2. Review and edit the proposed terms</h2>
              <ClaimWorkbench
                key={JSON.stringify(terms)}
                initialTerms={terms}
                onReview={setReview}
              />
            </>
          )}
        </>
      )}
      {review && !result && (
        <section className="detail-panel">
          <h2>3. Confirm this replay</h2>
          <blockquote className="original-call">{original}</blockquote>
          <p>
            {review.instrument.symbol}: {describePrediction(review)} ·{" "}
            {formatHorizon(review.horizon)}
          </p>
          <p>
            Simulated logging date: {date}. The actual entry timestamp is created on the server now.
          </p>
          <div className="form-actions">
            <Button onClick={run} disabled={busy}>
              {busy ? "Loading historical prices…" : "Confirm and resolve historical replay"}
            </Button>
            <Button variant="quiet" onClick={() => setReview(null)} disabled={busy}>
              Edit terms
            </Button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {result && (
        <>
          <p>Actual replay entry time: {result.recordedAt}</p>
          <ReplayResult attempt={result.attempt} marketData />
          <section className="detail-panel">
            <h2>AI explanation from supplied prices</h2>
            {result.explanation ? (
              <>
                <p>{result.explanation.summary}</p>
                {result.explanation.sources.map((source) => (
                  <p key={source.id}>
                    <a className="text-link" href={source.url} target="_blank" rel="noreferrer">
                      {source.symbol} · {source.date} · Massive
                    </a>
                  </p>
                ))}
              </>
            ) : (
              <p>
                The measured outcome is available above. Claude explanation is unavailable for this
                attempt.
              </p>
            )}
            <p className="field-help">
              Prices alone do not establish the cause of a move or validate the stated rationale.
            </p>
          </section>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setReview(null);
            }}
          >
            Run another replay
          </Button>
        </>
      )}
    </>
  );
}
