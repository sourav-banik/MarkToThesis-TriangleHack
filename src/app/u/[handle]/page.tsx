import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createPublicSupabaseClient } from "@/lib/server/supabase";
import { LiveClaimList } from "@/features/claims/components/live-claim-list";
import { EmptyState } from "@/components/ui/empty-state";

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
  const { data, error } = await client
    .from("profiles")
    .select("handle,display_name,bio")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new Error("Author records are temporarily unavailable.");
  if (!data) notFound();
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">PUBLIC CLAIMS LOGGED ON PROVENALPHA</span>
        <h1>{data.display_name}</h1>
        <p>
          @{data.handle} · {data.bio || "A public record of logged calls."}
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
