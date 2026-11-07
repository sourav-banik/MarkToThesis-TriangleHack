"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-container">
      <EmptyState
        title="This view couldn’t load"
        action={
          <div className="button-row">
            <Button onClick={reset}>Try again</Button>
            <Link href="/" className={buttonClass("secondary")}>
              Return to feed
            </Link>
          </div>
        }
      >
        <p>Try loading the view again. No claim was submitted by this preview.</p>
      </EmptyState>
    </div>
  );
}
