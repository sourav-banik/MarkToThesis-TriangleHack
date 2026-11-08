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
          <dd>{summary.awaitingStart + summary.unscored}</dd>
        </div>
        <div>
          <dt>Awaiting data</dt>
          <dd>{summary.awaitingStart}</dd>
        </div>
        <div>
          <dt>Unscored stances</dt>
          <dd>{summary.unscored}</dd>
        </div>
      </dl>
      <p>
        Counts cover all {mine ? "your public and private" : "public"} calls, regardless of the
        filters or page below. Live resolution is not connected yet; accuracy and return statistics
        are unavailable. Synthetic outcomes are excluded.
      </p>
    </section>
  );
}
