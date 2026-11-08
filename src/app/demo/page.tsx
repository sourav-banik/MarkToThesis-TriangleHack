import { MarketReplay } from "@/features/replay/components/market-replay";
export const metadata = { title: "Historical market replay" };
export default function DemoPage() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">MVP WALKTHROUGH</span>
        <h1>
          A call, clarified.
          <br />
          <em>An outcome, explained.</em>
        </h1>
        <p>
          Use Claude to make a vague call testable, confirm it, and resolve it against real
          historical market data.
        </p>
      </div>
      <MarketReplay />
    </div>
  );
}
