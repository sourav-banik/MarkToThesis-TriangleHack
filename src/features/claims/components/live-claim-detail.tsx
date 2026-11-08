import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/features/profiles/contracts";
import type { PersistedClaim } from "../live-contracts";
import { describePrediction, formatHorizon } from "../presentation";
import { ResolveClaimButton } from "./resolve-claim-button";
import { ReasoningReviewPanel } from "./reasoning-review-panel";
import { ClaimComments } from "./claim-comments";
import { ClaimPriceChart } from "./claim-price-chart";

export function LiveClaimDetail({ claim, author, canManage = false, canComment = false }: { claim: PersistedClaim; author: Profile; canManage?: boolean; canComment?: boolean }) {
  const { version } = claim;
  const time = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date(version.committedAt));
  return (
    <>
      <div className="live-record-notice">
        <LockKeyhole size={20} aria-hidden="true" />
        <div>
          <strong>Live claim · database timestamp</strong>
          <p>
            {version.visibility === "public"
              ? "Public terms and original wording remain visible."
              : "Private record: only the signed-in owner can access it."}{" "}
            This timestamp proves logging on MarkToThesis, not a trade or a prior post elsewhere.
          </p>
        </div>
      </div>
      <div className="page-heading">
        <span className="eyebrow">LOGGED ON MARKTOTHESIS</span>
        <h1>
          The original call.
          <br />
          <em>A lasting record.</em>
        </h1>
      </div>
      <div className="replay-detail-grid">
        <section className="detail-panel locked-claim">
          <div className="section-heading">
            <span className="eyebrow">VERSION {version.version} · LOCKED TERMS</span>
            <Badge tone={claim.status === "unscored" || claim.status === "not_met" ? "muted" : "purple"}>
              {claim.status === "unscored" ? "Unscored" : claim.status === "met" ? "Met" : claim.status === "not_met" ? "Not met" : claim.status === "unclear" ? "Unclear" : "Awaiting data"}
            </Badge>
          </div>
          <blockquote className="original-call">{version.originalText}</blockquote>
          <p className="locked-condition">
            {version.terms.instrument.symbol}: {describePrediction(version.terms)}
          </p>
          <dl className="detail-list">
            <div>
              <dt>Server logging time</dt>
              <dd>
                {time}
                <small>Database value: {version.committedAt}</small>
              </dd>
            </div>
            <div>
              <dt>Horizon</dt>
              <dd>{formatHorizon(version.terms.horizon)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>
                {version.terms.confidencePct === null
                  ? "Unstated"
                  : `${version.terms.confidencePct}%`}
              </dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>
                {version.visibility === "public" ? "Public at commitment" : "Private · owner only"}
              </dd>
            </div>
            <div>
              <dt>Exact instrument</dt>
              <dd>{version.terms.instrument.definition}</dd>
            </div>
            {(version.terms.prediction.kind === "outperform" ||
              version.terms.prediction.kind === "underperform") && (
              <div>
                <dt>Exact benchmark</dt>
                <dd>{version.terms.prediction.benchmark.definition}</dd>
              </div>
            )}
            <div>
              <dt>Measurement rules</dt>
              <dd>
                Daily observations. Start strictly after commitment, review on or after the target.
                No substitution for missing data. Price performance excludes dividends.
              </dd>
            </div>
          </dl>
          {claim.resolution ? (
            <section className="aside-card" aria-label="Live resolution result">
              <span className="eyebrow">MASSIVE LIVE RESOLUTION</span>
              <h2>{claim.resolution.outcome === "met" ? "Met" : claim.resolution.outcome === "not_met" ? "Not met" : claim.resolution.outcome === "unscored" ? "Unscored" : "Unclear"}</h2>
              {"measurement" in claim.resolution && claim.resolution.measurement.kind === "price_return" && (
                <p>
                  Asset {claim.resolution.measurement.assetReturnPct.toFixed(2)}%
                  {claim.resolution.measurement.benchmarkReturnPct === null ? "" : ` vs benchmark ${claim.resolution.measurement.benchmarkReturnPct.toFixed(2)}%`}
                  {claim.resolution.measurement.excessReturnPp === null ? "" : ` · excess ${claim.resolution.measurement.excessReturnPp.toFixed(2)} pp`}
                </p>
              )}
              {claim.resolution.outcome === "unclear" && <p>{claim.resolution.reason}</p>}
              <small>Price performance excludes dividends; Massive split-adjusted bars are used.</small>
            </section>
          ) : canManage ? (
            <ResolveClaimButton claimId={version.claimId} />
          ) : null}
          {claim.supersedesClaimId && (
            <Link href={`/claims/${claim.supersedesClaimId}`} className="text-link">
              Inspect the original linked claim <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </section>
        <aside>
          <div className="aside-card">
            <span className="eyebrow">THE AUTHOR</span>
            <h2>{author.displayName}</h2>
            <p className="replay-coverage-note">@{author.handle}</p>
            <Link href={`/u/${author.handle}`} className="text-link">
              Public author record <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="aside-footnote">
            <span className="eyebrow">NO REPLAY PRICES</span>
            <p>
              {claim.status === "unscored"
                ? "A position-only hold records a stance, not a measurable market outcome. It is excluded from performance statistics."
                : claim.resolution
                  ? "The result below is calculated from the saved claim terms and the provider observations shown in the resolution record."
                  : "Resolve this claim when its review horizon has elapsed. No result is invented before the required observations exist."}
            </p>
          </div>
        </aside>
      </div>
      <ClaimPriceChart claimId={version.claimId} />
      <section className="detail-panel replay-reasoning">
        <span className="eyebrow">REASONING, SEPARATE FROM SCORING</span>
        <h2>The stated rationale</h2>
        <p>{version.terms.rationale || "No rationale was supplied."}</p>
        {version.terms.assumptions.map((assumption) => (
          <div className="assumption" key={assumption.id}>
            <strong>{assumption.statement}</strong>
            <p>What would change this view: {assumption.falsificationCondition}</p>
          </div>
        ))}
      </section>
      <ReasoningReviewPanel
        claimId={version.claimId}
        assumptions={version.terms.assumptions.map(({ id, statement }) => ({ id, statement }))}
        review={claim.reasoningReview}
        canManage={canManage}
      />
      <ClaimComments claimId={version.claimId} canComment={canComment} />
    </>
  );
}
