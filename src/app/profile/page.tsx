import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Your record" };

export default function ProfilePage() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">THE WHOLE PICTURE</span>
        <h1>
          A record built
          <br />
          <em>one call at a time.</em>
        </h1>
        <p>Original terms. Measured results. Room for the misses.</p>
      </div>
      <section className="profile-panel">
        <div className="profile-heading">
          <span className="profile-avatar">
            <UserRound size={26} aria-hidden="true" />
          </span>
          <div>
            <h2>Your public record</h2>
            <p>Account connection comes in a later increment.</p>
          </div>
          <Badge tone="purple">Preview</Badge>
        </div>
        <div className="profile-metrics">
          {["Public claims", "Resolved claims", "Claim hit rate", "Active claims"].map((label) => (
            <div key={label}>
              <span>{label}</span>
              <strong>—</strong>
            </div>
          ))}
        </div>
        <EmptyState
          title="A clean slate, not an invented track record"
          action={
            <Link href="/new" className={buttonClass()}>
              Explore your first claim <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          <p>
            Once accounts and persistence are connected, this page will show claims logged on
            MarkToThesis—including misses and unclear outcomes.
          </p>
        </EmptyState>
      </section>
      <div className="inline-note">
        <p>
          <strong>Separate records, clear context.</strong> Historical replays, late-publicized
          calls, and unscored position statements stay outside prospective performance statistics.
        </p>
      </div>
    </div>
  );
}
