"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClaimWorkbench } from "@/features/claims/components/claim-workbench";
import { commitmentTermsSchema, type ConfirmedTerms } from "@/features/claims/contracts";
import { describePrediction, formatHorizon } from "@/features/claims/presentation";
import { targetDateForHorizon } from "@/features/resolution/calendar";
import { initialReplayTerms, REPLAY_COVERAGE, REPLAY_START } from "../dataset";
import { confirmReplay } from "../store";
import { formatReplayTime, formatSessionDate } from "../presentation";
import { ReplayNotice } from "./replay-notice";

export function ReplayWorkflow() {
  const router = useRouter();
  const [stage, setStage] = useState<"draft" | "review">("draft");
  const [originalText, setOriginalText] = useState("Apple should do better than the market.");
  const [rationale, setRationale] = useState("");
  const [falsification, setFalsification] = useState("");
  const [terms, setTerms] = useState(initialReplayTerms);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmationStarted = useRef(false);

  function review(proposed: ConfirmedTerms) {
    if (!originalText.trim()) {
      setError("Write the original market call before reviewing its terms.");
      return;
    }
    if (falsification.trim() && !rationale.trim()) {
      setError("Add the reasoning that your change-of-view evidence would challenge.");
      return;
    }
    const parsed = commitmentTermsSchema.safeParse({
      ...proposed,
      rationale: rationale.trim(),
      assumptions: falsification.trim()
        ? [
            {
              id: "stated-assumption",
              statement: rationale.trim(),
              falsificationCondition: falsification.trim(),
            },
          ]
        : [],
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    const target = targetDateForHorizon("2024-01-02", parsed.data.horizon);
    if (!target.ok) {
      setError(target.reason);
      return;
    }
    setTerms(parsed.data);
    setError(null);
    setStage("review");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function confirm() {
    if (confirmationStarted.current) return;
    confirmationStarted.current = true;
    setConfirming(true);
    try {
      const id = confirmReplay(terms, originalText.trim());
      router.push(`/replay/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This replay could not be confirmed.");
      setConfirming(false);
      confirmationStarted.current = false;
    }
  }
  const target = targetDateForHorizon("2024-01-02", terms.horizon);

  return (
    <>
      <ReplayNotice />
      <ol className="replay-steps" aria-label="Replay progress">
        <li aria-current={stage === "draft" ? "step" : undefined}>
          <span>01</span>Define the call
        </li>
        <li aria-current={stage === "review" ? "step" : undefined}>
          <span>02</span>Review & lock
        </li>
        <li>
          <span>03</span>Resolve & inspect
        </li>
      </ol>
      {error && (
        <div role="alert" className="form-message error">
          {error}
        </div>
      )}
      {stage === "draft" ? (
        <>
          <section className="replay-draft-panel form-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">START WITH THE ORIGINAL WORDS</span>
                <h2>A view before it becomes a test.</h2>
              </div>
              <Badge>Manual clarification</Badge>
            </div>
            <div className="field-group">
              <label htmlFor="original-call">Your market call</label>
              <textarea
                id="original-call"
                rows={3}
                value={originalText}
                onChange={(event) => {
                  setOriginalText(event.target.value);
                  setError(null);
                }}
              />
              <p className="field-help">
                Keep the original wording. Define the precise test below; no AI interpretation is
                running in this demo.
              </p>
            </div>
            <div className="form-row">
              <div className="field-group">
                <label htmlFor="rationale">Why do you expect this? · optional</label>
                <textarea
                  id="rationale"
                  rows={3}
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                />
              </div>
              <div className="field-group">
                <label htmlFor="falsification">What would change your view? · optional</label>
                <textarea
                  id="falsification"
                  rows={3}
                  value={falsification}
                  onChange={(event) => setFalsification(event.target.value)}
                />
              </div>
            </div>
            <p className="replay-coverage-note">
              Example fields start with AAPL versus SPY over three calendar days. Prices cover{" "}
              {REPLAY_COVERAGE} only. Longer horizons can remain pending.
            </p>
          </section>
          <ClaimWorkbench initialTerms={terms} onReview={review} />
        </>
      ) : (
        <div className="replay-review-grid">
          <section className="detail-panel">
            <span className="eyebrow">REVIEW BEFORE CONFIRMING</span>
            <h2>The exact call you’re locking.</h2>
            <blockquote className="original-call">{originalText.trim()}</blockquote>
            <dl className="detail-list">
              <div>
                <dt>Measurable condition</dt>
                <dd>
                  {terms.instrument.symbol}: {describePrediction(terms)}
                </dd>
              </div>
              <div>
                <dt>Horizon</dt>
                <dd>
                  {formatHorizon(terms.horizon)}
                  {target.ok && <> · target {formatSessionDate(target.date)}</>}
                </dd>
              </div>
              <div>
                <dt>Instrument definition</dt>
                <dd>{terms.instrument.definition}</dd>
              </div>
              {(terms.prediction.kind === "outperform" ||
                terms.prediction.kind === "underperform") && (
                <div>
                  <dt>Benchmark definition</dt>
                  <dd>{terms.prediction.benchmark.definition}</dd>
                </div>
              )}
              <div>
                <dt>Observation rule</dt>
                <dd>
                  First scheduled fixing after the simulated start; first scheduled fixing on or
                  after the target. Comparisons use common session dates.
                </dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{terms.confidencePct === null ? "Unstated" : `${terms.confidencePct}%`}</dd>
              </div>
              <div>
                <dt>Measurement</dt>
                <dd>
                  {terms.instrument.quote.kind === "yield"
                    ? "Yield levels in percent; changes in basis points. No bond return is inferred."
                    : terms.prediction.kind === "range" &&
                        terms.prediction.metric === "quoted_value"
                      ? "Nominal quoted prices, with inclusive bounds. Dividends excluded."
                      : "Price return, excluding dividends. Equity/ETF returns adjust for splits."}
                </dd>
              </div>
              <div>
                <dt>Your reasoning</dt>
                <dd>{terms.rationale || "No rationale supplied."}</dd>
              </div>
              {terms.assumptions.map((assumption) => (
                <div key={assumption.id}>
                  <dt>What would change your view</dt>
                  <dd>{assumption.falsificationCondition}</dd>
                </div>
              ))}
            </dl>
            <div className="form-actions">
              <Button onClick={confirm} disabled={confirming}>
                <LockKeyhole size={15} aria-hidden="true" />
                {confirming ? "Opening replay…" : "Confirm & lock replay"}
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setStage("draft");
                  setError(null);
                }}
                disabled={confirming}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Edit draft
              </Button>
            </div>
          </section>
          <aside>
            <div className="aside-card">
              <Badge tone="purple">Synthetic replay</Badge>
              <h2>
                Two dates.
                <br />
                Two different meanings.
              </h2>
              <dl className="detail-list">
                <div>
                  <dt>Simulated market start</dt>
                  <dd>{formatReplayTime(REPLAY_START)}</dd>
                </div>
                <div>
                  <dt>Confirmation time</dt>
                  <dd>
                    Captured from this browser when you confirm. It does not backdate a forecast or
                    create a server-verified record.
                  </dd>
                </div>
              </dl>
              <p className="replay-coverage-note">
                Terms stay locked in this tab. Results come from the existing deterministic engine,
                using fabricated prices.
              </p>
            </div>
            <div className="aside-footnote">
              <span className="eyebrow">THEN FOLLOW THE EVIDENCE</span>
              <p>
                Inspect the actual inputs and calculation, then open the fictional author’s full
                replay history—including misses.
              </p>
              <span className="text-link">
                Resolve & inspect <ArrowRight size={14} aria-hidden="true" />
              </span>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
