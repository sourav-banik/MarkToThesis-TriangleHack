import type { RecordSummary } from "@/features/feed/contracts";

export function RecordSummaryPanel({ summary, mine }: { summary: RecordSummary; mine: boolean }) {
  return (
    <section className="record-summary" aria-label="Complete record summary">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE COMPLETE {mine ? "OWNER" : "PUBLIC"} RECORD</span>
          <h2>Every logged call counts.</h2>
        </div>
      </div>
      <dl className="record-summary-metrics">
        <div>
          <dt>Logged calls</dt>
          <dd>{summary.total}</dd>
        </div>
        <div>
          <dt>Scored</dt>
          <dd>{summary.scored}</dd>
        </div>
        <div>
          <dt>Met</dt>
          <dd>{summary.met}</dd>
        </div>
        <div>
          <dt>Not met</dt>
          <dd>{summary.notMet}</dd>
        </div>
        <div>
          <dt>Met rate</dt>
          <dd>{summary.scored ? `${Math.round((summary.met / summary.scored) * 100)}%` : "—"}</dd>
        </div>
      </dl>
      <p>
        Based on saved deterministic outcomes across all {mine ? "your public and private" : "public"} calls. Pending ({summary.pending}), unclear ({summary.unclear}), and position-only ({summary.unscored}) calls are excluded from the met rate. Synthetic replays are excluded.
      </p>
    </section>
  );
}
