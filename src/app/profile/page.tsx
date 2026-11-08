import type { Metadata } from "next";
import { ReplayHistory } from "@/features/replay/components/replay-history";
import { accountState } from "@/features/auth/server";

export const metadata: Metadata = { title: "Author record" };
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string }>;
}) {
  const [query, account] = await Promise.all([searchParams, accountState()]);
  const initialTab = query.record === "demo" ? "demo" : account.user ? "live" : "demo";
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">THE WHOLE PICTURE</span>
        <h1>
          A record built
          <br />
          <em>one call at a time.</em>
        </h1>
        <p>
          Your saved calls and the fictional demo history stay separate. Original terms remain
          visible.
        </p>
      </div>
      <ReplayHistory key={initialTab} initialTab={initialTab} />
    </div>
  );
}
