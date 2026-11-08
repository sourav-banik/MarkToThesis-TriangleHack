"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/features/auth/use-account";
import { defaultTerms } from "@/demo/claims";
import { instruments } from "@/features/market-data/catalog";
import { liveClaimRequestSchema, persistedClaimSchema } from "../live-contracts";
import { describePrediction, formatHorizon } from "../presentation";
import type { ConfirmedTerms } from "../contracts";
import { ClaimWorkbench } from "./claim-workbench";

function startingTerms(): ConfirmedTerms {
  return {
    ...defaultTerms,
    assumptions: [],
    instrument: instruments.aapl,
    prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
    horizon: { kind: "duration", value: 30, unit: "days" },
  };
}
export function LiveClaimComposer() {
  const router = useRouter();
  const { account, error: accountError } = useAccount();
  const [stage, setStage] = useState<"draft" | "review">("draft");
  const [terms, setTerms] = useState(startingTerms);
  const [original, setOriginal] = useState("");
  const [rationale, setRationale] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submission = useRef<{ key: string; body: string } | null>(null);
  const saving = useRef(false);

  function review(candidate: ConfirmedTerms) {
    const proposed = { ...candidate, rationale: rationale.trim() };
    const check = liveClaimRequestSchema.safeParse({
      idempotencyKey: crypto.randomUUID(),
      originalText: original,
      terms: proposed,
      visibility,
    });
    if (!check.success) {
      setError(check.error.issues.map((issue) => issue.message).join(" "));
      window.scrollTo(0, 0);
      return;
    }
    setTerms(check.data.terms);
    setStage("review");
    setError(null);
    submission.current = null;
    window.scrollTo(0, 0);
  }
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    const key = submission.current?.key ?? crypto.randomUUID();
    const body =
      submission.current?.body ??
      JSON.stringify({
        idempotencyKey: key,
        originalText: original.trim(),
        terms,
        visibility,
        supersedesClaimId: null,
      });
    submission.current = { key, body };
    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "The claim could not be saved. Retry the same submission safely.",
        );
      const saved = persistedClaimSchema.parse(result.claim);
      router.push(`/claims/${saved.version.claimId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The claim could not be saved.");
      saving.current = false;
      setBusy(false);
    }
  }
  if (accountError)
    return (
      <p role="alert" className="form-message error">
        {accountError}
      </p>
    );
  if (!account)
    return (
      <p role="status" className="replay-loading">
        Checking live account access…
      </p>
    );
  if (!account.user)
    return (
      <>
        <div className="inline-note">
          <p>
            <strong>
              {account.configured
                ? "Sign in to log a live call."
                : "Live accounts are not connected in this preview."}
            </strong>{" "}
            You can explore the form below. A saved claim requires a signed-in account and a
            database timestamp.
          </p>
          <Link href="/account?next=/new" className="text-link">
            {account.configured ? "Sign in" : "Account setup"}
          </Link>
        </div>
        <ClaimWorkbench />
      </>
    );
  return (
    <>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {stage === "draft" ? (
        <>
          <section className="form-panel live-draft-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">LIVE CLAIM · MANUAL TERMS</span>
                <h2>Keep the original words.</h2>
              </div>
              <Badge tone="purple">Signed in</Badge>
            </div>
            <div className="field-group">
              <label htmlFor="live-original">Original market call</label>
              <textarea
                id="live-original"
                rows={3}
                maxLength={8000}
                value={original}
                onChange={(event) => setOriginal(event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="live-rationale">Reasoning · optional</label>
              <textarea
                id="live-rationale"
                rows={3}
                maxLength={8000}
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="live-visibility">Visibility at commitment</label>
              <select
                id="live-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "public" | "private")}
              >
                <option value="private">Private · only you</option>
                <option value="public">Public · visible in your record</option>
              </select>
              <p className="field-help">
                Public calls remain visible. Private calls cannot be selectively published after
                their outcome. Original terms are retained.
              </p>
            </div>
            <p className="field-help">
              Starting prices are not known before the eligible observation occurs. Price retrieval
              is not connected yet; scorable calls remain awaiting data.
            </p>
          </section>
          <ClaimWorkbench initialTerms={terms} onReview={review} purpose="live" />
        </>
      ) : (
        <section className="detail-panel live-review-panel">
          <Badge tone="purple">Review a real database commitment</Badge>
          <h2>Confirm the exact test.</h2>
          <blockquote className="original-call">{original.trim()}</blockquote>
          <dl className="detail-list">
            <div>
              <dt>Condition</dt>
              <dd>
                {terms.instrument.symbol}: {describePrediction(terms)}
              </dd>
            </div>
            <div>
              <dt>Horizon</dt>
              <dd>{formatHorizon(terms.horizon)}</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>
                {visibility === "public"
                  ? "Public, with original terms kept visible."
                  : "Private, available only to your account."}
              </dd>
            </div>
            <div>
              <dt>Reasoning</dt>
              <dd>{terms.rationale || "Unstated"}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{terms.confidencePct === null ? "Unstated" : `${terms.confidencePct}%`}</dd>
            </div>
            <div>
              <dt>Measurement</dt>
              <dd>
                First eligible observation strictly after database commitment; first eligible
                observation on or after the horizon. Daily fixing rules are locked. Market data is
                not connected yet.
              </dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>
                The database issues it when saving, not this browser. No historical replay timestamp
                or price is copied.
              </dd>
            </div>
          </dl>
          <div className="form-actions">
            <Button onClick={save} disabled={busy}>
              <LockKeyhole size={15} aria-hidden="true" />
              {busy ? "Saving claim…" : "Confirm & save live claim"}
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setStage("draft");
                submission.current = null;
                setError(null);
              }}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Edit before commitment
            </Button>
          </div>
          <p className="field-help">
            If a connection fails after saving, retrying the same submission returns the original
            claim and timestamp.
          </p>
        </section>
      )}
    </>
  );
}
