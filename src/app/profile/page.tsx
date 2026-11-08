import type { Metadata } from "next";
import Link from "next/link";
import { accountState } from "@/features/auth/server";
import { OwnerRecord } from "@/features/profiles/components/owner-record";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button";
import { ReplayHistory } from "@/features/replay/components/replay-history";

export const metadata: Metadata = { title: "Author record" };
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string }>;
}) {
  if ((await searchParams).record === "demo")
    return (
      <div className="page-container">
        <div className="page-heading">
          <h1>Illustrative author history</h1>
          <p>
            Fictional author and fabricated outcomes. These are excluded from all live statistics.
          </p>
        </div>
        <ReplayHistory initialTab="demo" />
      </div>
    );
  const account = await accountState();
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">YOUR TRACK RECORD</span>
        <h1>
          Every call.
          <br />
          <em>The complete record.</em>
        </h1>
        <p>See your logged calls, saved outcomes, and the share of scored calls that were met.</p>
      </div>
      {account.user ? (
        <OwnerRecord />
      ) : (
        <EmptyState
          title="Sign in to build your record"
          action={
            <Link href="/account?next=/profile" className={buttonClass()}>
              Sign in
            </Link>
          }
        >
          <p>Your live history is private until you choose to publish an individual claim.</p>
        </EmptyState>
      )}
    </div>
  );
}
