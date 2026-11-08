import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createPublicSupabaseClient } from "@/lib/server/supabase";
import { LiveClaimList } from "@/features/claims/components/live-claim-list";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicProfile } from "@/features/profiles/server";
import { HttpError } from "@/lib/server/http";

export const metadata: Metadata = { title: "Public author record" };
export default async function PublicAuthorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  if (!/^[a-z0-9_]{3,40}$/.test(handle)) notFound();
  const client = createPublicSupabaseClient();
  if (!client)
    return (
      <div className="page-container">
        <EmptyState title="Live author records are not connected yet">
          <p>
            Explore the{" "}
            <Link href="/profile?record=demo" className="text-link">
              fictional demo history
            </Link>{" "}
            while account setup is prepared.
          </p>
        </EmptyState>
      </div>
    );
  const profile = await getPublicProfile(client, handle).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">PUBLIC CLAIMS LOGGED ON MARKTOTHESIS</span>
        <h1>{profile.displayName}</h1>
        <p>
          @{profile.handle} · {profile.bio || "A public record of logged calls."}
        </p>
      </div>
      <div className="inline-note">
        <p>
          Only calls committed as public appear here. Private claims and synthetic replays are
          excluded. No investing skill or actual trades are verified by the timestamp.
        </p>
      </div>
      <LiveClaimList authorHandle={handle} />
    </div>
  );
}
