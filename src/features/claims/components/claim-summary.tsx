import { ArrowUpRight, Clock3, Gauge, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AssetMark } from "@/components/ui/asset-mark";
import type { ConfirmedTerms } from "../contracts";
import { isScorablePrediction } from "../contracts";
import { describePrediction, formatHorizon, predictionLabels } from "../presentation";

export function ClaimSummary({
  terms,
  originalText,
  href,
}: {
  terms: ConfirmedTerms;
  originalText?: string;
  href?: string;
}) {
  const scorable = isScorablePrediction(terms.prediction);
  return (
    <article className="claim-card">
      <div className="claim-card-top">
        <div className="asset-identity">
          <AssetMark instrument={terms.instrument} />
          <div>
            <strong>{terms.instrument.symbol}</strong>
            <span>{terms.instrument.name}</span>
          </div>
        </div>
        <Badge
          tone={
            terms.prediction.kind === "outperform"
              ? "green"
              : terms.prediction.kind === "underperform"
                ? "amber"
                : "purple"
          }
        >
          {predictionLabels[terms.prediction.kind]}
        </Badge>
      </div>
      {originalText && (
        <h3>
          {href ? (
            <Link className="claim-title-link" href={href}>
              {originalText}
            </Link>
          ) : (
            originalText
          )}
        </h3>
      )}
      <p className="claim-condition">{describePrediction(terms)}</p>
      <div className="claim-metadata">
        <span>
          <Clock3 size={14} aria-hidden="true" />
          {formatHorizon(terms.horizon)}
        </span>
        <span>
          <Gauge size={14} aria-hidden="true" />
          {terms.confidencePct === null
            ? "Confidence unstated"
            : `${terms.confidencePct}% confidence`}
        </span>
      </div>
      <div className="claim-card-bottom">
        <span>
          <LockKeyhole size={13} aria-hidden="true" />
          {scorable ? "Illustrative · not logged" : "Position statement · unscored"}
        </span>
        {href && (
          <Link
            href={href}
            aria-label={`Inspect ${terms.instrument.symbol} ${terms.prediction.kind} example`}
          >
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}
