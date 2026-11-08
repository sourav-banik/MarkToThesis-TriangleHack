import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, FileCheck2, Fingerprint, Scale } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { claimExamples } from "@/demo/claims";
import { ExampleFeed } from "@/features/feed/components/example-feed";
import { ReplayFeed } from "@/features/replay/components/replay-feed";
import { LiveClaimList } from "@/features/claims/components/live-claim-list";

export default function FeedPage() {
  return (
    <div className="page-container">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-line" />
            LESS NOISE. MORE ACCOUNTABILITY.
          </div>
          <h1>
            Conviction deserves
            <br />a <em>record.</em>
          </h1>
          <p>
            Make the call. Define what would make it right.
            <br className="desktop-break" /> Let the evidence tell the rest of the story.
          </p>
          <Link href="/new" className={buttonClass()}>
            Shape a claim <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="hero-aside">
          <div className="hero-aside-heading">
            <span className="hero-aside-mark">
              <Fingerprint size={23} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span>AN IDEA ISN’T A TRACK RECORD.</span>
          </div>
          <h2>
            The terms matter.
            <br /> So do the misses.
          </h2>
          <p>
            A market view becomes useful when someone can inspect what was said, what was measured,
            and what happened.
          </p>
          <div className="hero-aside-bottom">
            <Check size={15} aria-hidden="true" />A clearer standard for market calls
          </div>
        </div>
      </section>
      <div className="principles-strip">
        <span>
          <FileCheck2 size={17} aria-hidden="true" />
          <strong>Explicit terms</strong> before commitment
        </span>
        <span>
          <Fingerprint size={17} aria-hidden="true" />
          <strong>Original wording</strong> stays visible
        </span>
        <span>
          <Scale size={17} aria-hidden="true" />
          <strong>Code measures.</strong> AI explains.
        </span>
      </div>
      <section className="live-feed" aria-labelledby="live-feed-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PROSPECTIVE CLAIMS · DATABASE RECORDS</span>
            <h2 id="live-feed-title">Public calls and discussion</h2>
          </div>
        </div>
        <LiveClaimList />
      </section>
      <p className="inline-note">
        <Link className="text-link" href="/demo">
          Run the complete AI + historical market-data demo
        </Link>
      </p>
      <details className="detail-panel replay-reasoning">
        <summary>Explore a labeled replay or illustrative claim formats</summary>
        <ReplayFeed />
        <div className="content-with-aside">
          <ExampleFeed examples={claimExamples} />
          <aside className="context-aside">
            <div className="aside-card">
              <span className="eyebrow">FROM A VIEW TO A CLAIM</span>
              <h2>
                A little precision.
                <br />A lot more context.
              </h2>
              <ol className="workflow-list">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Say what you expect</strong>
                    <p>An asset, an outcome, a horizon.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Agree on the test</strong>
                    <p>Benchmarks, ranges, and clear units.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Keep the full picture</strong>
                    <p>The original call and its evidence.</p>
                  </div>
                </li>
              </ol>
              <Link href="/new" className="text-link">
                Explore a claim <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="aside-footnote">
              <span className="eyebrow">A NOTE ON TRUST</span>
              <p>
                A timestamp records when a claim enters MarkToThesis. It does not verify a trade or
                an earlier prediction elsewhere.
              </p>
            </div>
          </aside>
        </div>
      </details>
    </div>
  );
}
