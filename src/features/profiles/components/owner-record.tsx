"use client";

import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { useAccount } from "@/features/auth/use-account";
import { LiveClaimList } from "@/features/claims/components/live-claim-list";
import { buttonClass } from "@/components/ui/button";

export function OwnerRecord() {
  const { account } = useAccount();
  return (
    <section className="live-history">
      {account?.user && account.profile && (
        <div className="owner-record-heading">
          <span className="profile-avatar">
            <UserRound size={25} aria-hidden="true" />
          </span>
          <div>
            <h2>{account.profile.displayName}</h2>
            <p>@{account.profile.handle}</p>
            {account.profile.bio && <p>{account.profile.bio}</p>}
          </div>
          <div className="owner-record-links">
            <Link href={`/u/${account.profile.handle}`} className="text-link">
              View public profile <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/account" className={buttonClass("secondary")}>
              Edit profile
            </Link>
          </div>
        </div>
      )}
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR LIVE RECORD</span>
          <h2>Calls, outcomes, and context</h2>
        </div>
        <Link href="/new" className={buttonClass()}>
          Log a claim
        </Link>
      </div>
      <LiveClaimList scope="mine" simple />
    </section>
  );
}
