"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  feedPageSchema,
  defaultFeedFilters,
  writeFeedFilters,
  type FeedFilters,
  type FeedCursor,
  type FeedRecord,
  type RecordSummary,
} from "@/features/feed/contracts";
import { FeedFiltersForm } from "@/features/feed/components/feed-filters";
import { RecordSummaryPanel } from "@/features/profiles/components/record-summary";
import { LiveClaimCard } from "./live-claim-card";

type Props = { scope?: "public" | "mine"; authorHandle?: string };
export function LiveClaimList({ scope = "public", authorHandle }: Props) {
  const [filters, setFilters] = useState(defaultFeedFilters);
  return (
    <div className="live-record-browser">
      <FeedFiltersForm mine={scope === "mine"} onApply={setFilters} />
      <FeedResults
        key={`${scope}:${authorHandle ?? ""}:${JSON.stringify(filters)}`}
        scope={scope}
        authorHandle={authorHandle}
        filters={filters}
      />
    </div>
  );
}

function FeedResults({
  scope = "public",
  authorHandle,
  filters,
}: Props & { filters: FeedFilters }) {
  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const pendingRequest = useRef<AbortController | null>(null);
  const failedCursor = useRef<FeedCursor | null>(null);
  const load = useCallback(
    async (after: FeedCursor | null = null) => {
      pendingRequest.current?.abort();
      const controller = new AbortController();
      pendingRequest.current = controller;
      failedCursor.current = after;
      try {
        const url = new URL(
          authorHandle ? `/api/authors/${encodeURIComponent(authorHandle)}` : "/api/claims",
          window.location.origin,
        );
        if (!authorHandle) url.searchParams.set("scope", scope);
        writeFeedFilters(url.searchParams, filters);
        if (after) {
          url.searchParams.set("beforeTime", after.createdAt);
          url.searchParams.set("beforeId", after.id);
        }
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401 && scope === "mine") {
          setNeedsSignIn(true);
          setRecords([]);
          setSummary(null);
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "Claims could not be loaded.");
        const page = feedPageSchema.parse(body);
        setRecords((previous) =>
          after
            ? [
                ...previous,
                ...page.claims.filter(
                  (item) => !previous.some((old) => old.version.claimId === item.version.claimId),
                ),
              ]
            : page.claims,
        );
        setCursor(page.nextCursor);
        if (!after) setSummary(page.summary);
        setConfigured(page.configured);
        setError(null);
        setNeedsSignIn(false);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Claims could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [scope, authorHandle, filters],
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    const accountChanged = () => {
      setRecords([]);
      setSummary(null);
      setCursor(null);
      setError(null);
      setConfigured(null);
      setNeedsSignIn(false);
      setBusy(true);
      void load();
    };
    window.addEventListener("provenalpha:account-changed", accountChanged);
    return () => {
      active = false;
      pendingRequest.current?.abort();
      window.removeEventListener("provenalpha:account-changed", accountChanged);
    };
  }, [load]);
  if (needsSignIn)
    return (
      <EmptyState
        title="Sign in to see your saved record"
        action={
          <Link href="/account?next=/profile" className={buttonClass()}>
            Sign in
          </Link>
        }
      >
        <p>Your private calls are only available to your account.</p>
      </EmptyState>
    );
  if (configured === null && !error)
    return (
      <p role="status" className="replay-loading">
        Loading saved claims…
      </p>
    );
  if (configured === false)
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
  const filtered = JSON.stringify(filters) !== JSON.stringify(defaultFeedFilters);
  return (
    <>
      {summary && <RecordSummaryPanel summary={summary} mine={scope === "mine"} />}
      {error && (
        <div className="live-feed-error">
          <p role="alert">{error}</p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void load(failedCursor.current);
            }}
          >
            {busy ? "Retrying…" : "Retry loading claims"}
          </Button>
        </div>
      )}
      {records.length ? (
        <>
          <div className="live-results-caption">
            <p role="status">
              Showing {records.length} {filtered ? "matching " : ""}logged{" "}
              {records.length === 1 ? "call" : "calls"}
              {cursor ? " · more available" : ""}
            </p>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void load();
              }}
            >
              Refresh record
            </Button>
          </div>
          <div className="live-claim-grid">
            {records.map((record) => (
              <LiveClaimCard claim={record} author={record.author} key={record.version.claimId} />
            ))}
          </div>
        </>
      ) : (
        !error && (
          <EmptyState
            title={
              filtered
                ? "No calls match these filters"
                : scope === "mine"
                  ? "Your saved record starts here"
                  : "No public live calls yet"
            }
            action={
              !filtered && (
                <Link href="/new" className={buttonClass()}>
                  Log a call
                </Link>
              )
            }
          >
            <p>
              {filtered
                ? "Try another search or reset the filters. The original record remains unchanged."
                : scope === "mine"
                  ? "Your public and private calls appear together here. Public readers can only see calls committed as public."
                  : "Only database-backed public calls appear here. Synthetic replays are excluded."}
            </p>
          </EmptyState>
        )
      )}
      {cursor && !error && (
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
