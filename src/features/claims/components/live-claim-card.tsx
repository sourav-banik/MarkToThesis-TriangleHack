import Link from "next/link";
import { LockKeyhole, Globe2, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AssetMark } from "@/components/ui/asset-mark";
import type { PersistedClaim } from "../live-contracts";
import { describePrediction, formatHorizon } from "../presentation";

export function LiveClaimCard({ claim }: { claim: PersistedClaim }) {
  const version = claim.version;
  return (
    <article className="live-claim-card">
      <div className="claim-card-top">
        <div className="asset-identity">
          <AssetMark instrument={version.terms.instrument} />
          <div>
            <strong>{version.terms.instrument.symbol}</strong>
            <span>Live claim · {formatHorizon(version.terms.horizon)}</span>
          </div>
        </div>
        <Badge tone={claim.status === "unscored" ? "muted" : "purple"}>
          {claim.status === "unscored" ? "Unscored" : "Awaiting data"}
        </Badge>
      </div>
      <h3>
        <Link href={`/claims/${version.claimId}`}>{version.originalText}</Link>
      </h3>
      <p>{describePrediction(version.terms)}</p>
      <div className="replay-record-footer">
        <span>
          {version.visibility === "public" ? (
            <Globe2 size={13} aria-hidden="true" />
          ) : (
            <LockKeyhole size={13} aria-hidden="true" />
          )}
          {version.visibility === "public" ? "Public · locked" : "Private · owner only"}
        </span>
        <span>
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeZone: "America/New_York",
          }).format(new Date(version.committedAt))}
        </span>
        <Link
          href={`/claims/${version.claimId}`}
          aria-label={`Inspect live claim: ${version.originalText}`}
        >
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
