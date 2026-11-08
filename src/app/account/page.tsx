import type { Metadata } from "next";
import { AccountPanel } from "@/features/auth/components/account-panel";

export const metadata: Metadata = { title: "Your account" };
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; confirmation?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">YOUR IDENTITY, YOUR RECORD</span>
        <h1>
          A place for
          <br />
          <em>your conviction.</em>
        </h1>
        <p>Sign in to log calls with database timestamps and keep a lasting record.</p>
      </div>
      <AccountPanel next={query.next} confirmationFailed={query.confirmation === "failed"} />
    </div>
  );
}
