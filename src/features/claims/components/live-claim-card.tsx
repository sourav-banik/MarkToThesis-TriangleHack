import Link from "next/link";
import { LockKeyhole, Globe2, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AssetMark } from "@/components/ui/asset-mark";
import type { PersistedClaim } from "../live-contracts";
import { describePrediction, formatHorizon } from "../presentation";
import type { Profile } from "@/features/profiles/contracts";

export function LiveClaimCard({ claim, author }: { claim: PersistedClaim; author: Profile }) {
  const version = claim.version;
  return (
    <article className="live-claim-card">
      <div className="live-card-author">
        <Link href={`/u/${author.handle}`}>
          <strong>{author.displayName}</strong>
          <span>@{author.handle}</span>
        </Link>
        <span>Logged on ProvenAlpha</span>
      </div>
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
      <div className="live-card-confidence">
        Confidence at commitment:{" "}
        <strong>
          {version.terms.confidencePct === null ? "Unstated" : `${version.terms.confidencePct}%`}
        </strong>
        {claim.supersedesClaimId && (
          <Link href={`/claims/${claim.supersedesClaimId}`}>Linked update · original retained</Link>
        )}
      </div>
      <div className="replay-record-footer">
        <span>
          {version.visibility === "public" ? (
            <Globe2 size={13} aria-hidden="true" />
          ) : (
            <LockKeyhole size={13} aria-hidden="true" />
          )}
          {version.visibility === "public" ? "Public · locked" : "Private · owner only"}
        </span>
        <time dateTime={version.committedAt} title={version.committedAt}>
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeZone: "America/New_York",
          }).format(new Date(version.committedAt))}
        </time>
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
