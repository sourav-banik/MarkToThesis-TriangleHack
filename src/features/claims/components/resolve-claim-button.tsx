"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

export function ResolveClaimButton({ claimId }: { claimId: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  async function resolve() {
    setState("working");
    try {
      const response = await fetch(`/api/claims/${claimId}/resolve`, { method: "POST" });
      if (!response.ok) throw new Error("Resolution failed");
      setState("done");
      window.location.reload();
    } catch {
      setState("error");
    }
  }
  return (
    <div>
      <button className={buttonClass("primary")} onClick={resolve} disabled={state === "working"}>
        {state === "working" ? "Checking Massive…" : "Resolve with live data"}
      </button>
      {state === "error" && <p className="form-error">Live resolution could not be completed.</p>}
      {state === "done" && <p className="form-success">Resolution saved.</p>}
    </div>
  );
}
