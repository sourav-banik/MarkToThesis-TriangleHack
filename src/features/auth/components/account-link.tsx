"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useAccount } from "../use-account";

export function AccountLink() {
  const { account } = useAccount();
  return (
    <Link href="/account" className="account-link">
      <UserRound size={15} aria-hidden="true" />
      {account?.user ? "Your account" : "Sign in"}
    </Link>
  );
}
