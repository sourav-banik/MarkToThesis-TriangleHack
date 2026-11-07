import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { claimExamples } from "@/demo/claims";
import { ClaimSummary } from "@/features/claims/components/claim-summary";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Inspect a claim format" };

export function generateStaticParams() {
  return claimExamples.map((example) => ({ id: example.id }));
}

export default async function ClaimExamplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const example = claimExamples.find((item) => item.id === id);
  if (!example) notFound();
  const { terms } = example;
  return (
    <div className="page-container">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to claim formats
      </Link>
      <div className="page-heading">
        <Badge tone="purple">Illustrative example · not logged</Badge>
        <h1>
          The call.
          <br />
          <em>And the conditions.</em>
        </h1>
        <p>Inspect the terms behind this example. No historical outcome is implied.</p>
      </div>
      <div className="detail-grid">
        <ClaimSummary terms={terms} originalText={example.originalText} />
        <section className="detail-panel">
          <span className="eyebrow">MEASUREMENT CONTEXT</span>
          <h2>What would be locked?</h2>
          <dl className="detail-list">
            <div>
              <dt>Exact instrument</dt>
              <dd>{terms.instrument.definition}</dd>
            </div>
            <div>
              <dt>Daily observation</dt>
              <dd>{terms.instrument.observation.fixing}</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>{terms.instrument.observation.timeZone}</dd>
            </div>
            <div>
              <dt>Performance convention</dt>
              <dd>
                {terms.instrument.quote.kind === "yield"
                  ? "Yield levels in percent; changes in basis points. Not an investment return."
                  : "Split-adjusted price return. Dividends excluded."}
              </dd>
            </div>
            <div>
              <dt>Logging timestamp</dt>
              <dd>None. This is an unsaved format example.</dd>
            </div>
          </dl>
        </section>
      </div>
      {terms.rationale && (
        <section className="detail-panel rationale-panel">
          <span className="eyebrow">REASONING, SEPARATE FROM THE RESULT</span>
          <h2>The stated rationale</h2>
          <p>{terms.rationale}</p>
          {terms.assumptions.map((assumption) => (
            <div key={assumption.id} className="assumption">
              <strong>{assumption.statement}</strong>
              <p>What would change this view: {assumption.falsificationCondition}</p>
            </div>
          ))}
        </section>
      )}
      <div className="inline-note">
        <p>
          <strong>Next comes commitment and measurement.</strong> Saving, server timestamps,
          market-data retrieval, and resolution are intentionally left for their own increments.
        </p>
        <Link href="/new" className={buttonClass("secondary")}>
          Explore another format <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
