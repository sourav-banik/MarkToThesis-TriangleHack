import Link from "next/link";
import { ArrowUpRight, Clock3, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AssetMark } from "@/components/ui/asset-mark";
import {
  describePrediction,
  formatHorizon,
  predictionLabels,
} from "@/features/claims/presentation";
import { evaluateReplay, type ReplayRecord } from "../dataset";
import { replayStatusLabels, replayTone } from "../presentation";

export function ReplayRecordCard({ record }: { record: ReplayRecord }) {
  const attempt = evaluateReplay(record);
  const status = attempt?.status ?? "ready";
  return (
    <article className="replay-record-card">
      <div className="claim-card-top">
        <div className="asset-identity">
          <AssetMark instrument={record.claim.terms.instrument} />
          <div>
            <strong>{record.claim.terms.instrument.symbol}</strong>
            <span>{predictionLabels[record.claim.terms.prediction.kind]} · synthetic replay</span>
          </div>
        </div>
        <Badge tone={replayTone(status)}>{replayStatusLabels[status]}</Badge>
      </div>
      <h3>
        <Link href={`/replay/${record.claim.claimId}`}>{record.claim.originalText}</Link>
      </h3>
      <p>{describePrediction(record.claim.terms)}</p>
      <div className="replay-record-footer">
        <span>
          <Clock3 size={13} aria-hidden="true" />
          {formatHorizon(record.claim.terms.horizon)}
        </span>
        <span>
          <LockKeyhole size={13} aria-hidden="true" />
          {record.origin === "browser" ? "Locked in this tab" : "Preloaded fixture"}
        </span>
        <Link
          href={`/replay/${record.claim.claimId}`}
          aria-label={`Inspect replay: ${record.claim.originalText}`}
        >
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
