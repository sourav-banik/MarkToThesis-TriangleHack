import { FlaskConical } from "lucide-react";
import { REPLAY_COVERAGE } from "../dataset";

export function ReplayNotice() {
  return (
    <div className="replay-notice">
      <FlaskConical size={21} aria-hidden="true" />
      <div>
        <strong>Synthetic replay · fabricated prices</strong>
        <p>
          Market dates: {REPLAY_COVERAGE}. This demo stays in this tab. No public claim, verified
          trade, or historical track record is created.
        </p>
      </div>
    </div>
  );
}
