import type { Metadata } from "next";
import { LiveClaimComposer } from "@/features/claims/components/live-claim-composer";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "Shape a claim" };

export default function NewClaimPage() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">CLARITY BEFORE CONVICTION</span>
        <h1>
          Make your view <em>testable.</em>
        </h1>
        <p>A comparison, a range, or a position. Give the next reader the terms.</p>
      </div>
      <div className="inline-note replay-entry-note">
        <p>
          <strong>Want to see the complete loop?</strong> Confirm a synthetic replay, calculate its
          outcome, and inspect the demo author’s history.
        </p>
        <Link href="/replay" className="text-link">
          Open synthetic replay <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <LiveClaimComposer />
    </div>
  );
}
