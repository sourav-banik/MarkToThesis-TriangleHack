"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { persistedClaimSchema, type PersistedClaim } from "../live-contracts";
import { LiveClaimCard } from "./live-claim-card";

const pageSchema = z.object({
  configured: z.boolean().optional(),
  claims: z.array(persistedClaimSchema),
  nextCursor: z.object({ createdAt: z.string(), id: z.string() }).nullable(),
});
type Cursor = z.infer<typeof pageSchema>["nextCursor"];
export function LiveClaimList({
  scope = "public",
  authorHandle,
}: {
  scope?: "public" | "mine";
  authorHandle?: string;
}) {
  const [records, setRecords] = useState<PersistedClaim[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const pendingRequest = useRef<AbortController | null>(null);
  const load = useCallback(
    async (after: Cursor = null) => {
      pendingRequest.current?.abort();
      const controller = new AbortController();
      pendingRequest.current = controller;
      try {
        const url = new URL(
          authorHandle ? `/api/authors/${encodeURIComponent(authorHandle)}` : "/api/claims",
          window.location.origin,
        );
        if (!authorHandle) url.searchParams.set("scope", scope);
        if (after) {
          url.searchParams.set("beforeTime", after.createdAt);
          url.searchParams.set("beforeId", after.id);
        }
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Claims could not be loaded.");
        const page = pageSchema.parse(body);
        if (controller.signal.aborted) return;
        setRecords((previous) =>
          after
            ? [
                ...previous,
                ...page.claims.filter(
                  (item) =>
                    !previous.some((existing) => existing.version.claimId === item.version.claimId),
                ),
              ]
            : page.claims,
        );
        setCursor(page.nextCursor);
        setConfigured(page.configured ?? true);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Claims could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [scope, authorHandle],
  );
  useEffect(() => {
    void Promise.resolve().then(() => load());
    const accountChanged = () => {
      setRecords([]);
      setConfigured(null);
      setBusy(true);
      void load();
    };
    window.addEventListener("provenalpha:account-changed", accountChanged);
    return () => {
      pendingRequest.current?.abort();
      window.removeEventListener("provenalpha:account-changed", accountChanged);
    };
  }, [load]);
  if (error)
    return (
      <div className="detail-panel">
        <p role="alert">{error}</p>
        <div className="button-row">
          <Button
            variant="secondary"
            onClick={() => {
              setBusy(true);
              void load();
            }}
          >
            Retry
          </Button>
          {scope === "mine" && (
            <Link href="/account?next=/profile" className={buttonClass()}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    );
  if (configured === null)
    return (
      <p role="status" className="replay-loading">
        Loading saved claims…
      </p>
    );
  if (!configured)
    return scope === "mine" ? (
      <EmptyState
        title="A clean slate, not an invented track record"
        action={
          <Link href="/account?next=/profile" className={buttonClass()}>
            Account setup
          </Link>
        }
      >
        <p>
          Live accounts are not connected in this preview. Synthetic replays remain separate from
          prospective public records.
        </p>
      </EmptyState>
    ) : (
      <div className="live-feed-empty">
        <p>
          Live accounts are not connected in this preview. Explore the synthetic examples below, or
          open account setup.
        </p>
        <Link href="/account" className="text-link">
          Account setup
        </Link>
      </div>
    );
  return (
    <>
      {records.length ? (
        <div className="live-claim-grid">
          {records.map((record) => (
            <LiveClaimCard claim={record} key={record.version.claimId} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={scope === "mine" ? "Your saved record starts here" : "No public live calls yet"}
          action={
            <Link href="/new" className={buttonClass()}>
              Log a call
            </Link>
          }
        >
          <p>
            {scope === "mine"
              ? "Your public and private calls will appear together here. Public readers can only see calls committed as public."
              : "Only real database-backed public calls appear in this section. Synthetic replays do not enter this record."}
          </p>
        </EmptyState>
      )}
      {cursor && (
        <div className="load-more">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void load(cursor);
            }}
          >
            {busy ? "Loading…" : "Load older claims"}
          </Button>
        </div>
      )}
    </>
  );
}
