import type { Metadata } from "next";
import { ReplayWorkflow } from "@/features/replay/components/replay-workflow";

export const metadata: Metadata = { title: "Synthetic replay" };
export default function ReplayPage() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">FROM A VIEW TO AN OUTCOME</span>
        <h1>
          Make the call.
          <br />
          <em>Inspect the result.</em>
        </h1>
        <p>Walk through a complete replay with explicit terms and fabricated market data.</p>
      </div>
      <ReplayWorkflow />
    </div>
  );
}
