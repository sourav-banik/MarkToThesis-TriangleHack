"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

export function ResolveClaimButton({ claimId }: { claimId: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  async function resolve() {
    setState("working");
    try {
      const response = await fetch(`/api/claims/${claimId}/resolve`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Resolution failed");
      if (!result.attempt?.resolution) {
        setMessage(
          result.attempt?.reason ?? "This claim is still waiting for its review observations.",
        );
        setState("idle");
        return;
      }
      setState("done");
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Live resolution could not be completed.",
      );
      setState("error");
    }
  }
  return (
    <div>
      <button className={buttonClass("primary")} onClick={resolve} disabled={state === "working"}>
        {state === "working" ? "Checking Massive…" : "Resolve with live data"}
      </button>
      {message && (
        <p role="status" className={state === "error" ? "form-error" : "field-help"}>
          {message}
        </p>
      )}
      {state === "done" && <p className="form-success">Resolution saved.</p>}
    </div>
  );
}
