"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { claimChartResponseSchema, type ClaimChart } from "@/features/market-data/chart-contracts";

type Series = { symbol: string; points: { date: string; value: number }[]; color: string };
function normalized(series: Series) {
  const base = series.points[0]?.value;
  return base ? series.points.map((point) => ({ ...point, value: (point.value / base) * 100 })) : [];
}
function line(points: { date: string; value: number }[], start: number, end: number, min: number, max: number) {
  const width = 600, height = 210, pad = 18;
  const span = Math.max(end - start, 1), range = Math.max(max - min, 0.001);
  return points.map((point) => {
    const x = pad + ((Date.parse(`${point.date}T00:00:00Z`) - start) / span) * (width - pad * 2);
    const y = height - pad - ((point.value - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function Chart({ chart }: { chart: ClaimChart }) {
  const series = useMemo(() => {
    const all: Series[] = [{ ...chart.asset, color: "#795cdb" }];
    if (chart.benchmark) all.push({ ...chart.benchmark, color: "#e69b57" });
    return all.map((item) => ({ ...item, points: normalized(item) })).filter((item) => item.points.length > 0);
  }, [chart]);
  const allPoints = series.flatMap((item) => item.points);
  if (!allPoints.length) return <p>No daily bars are available for this window yet.</p>;
  const start = Date.parse(`${chart.fromDate}T00:00:00Z`);
  const end = Date.parse(`${chart.throughDate}T00:00:00Z`);
  const values = allPoints.map((item) => item.value);
  const min = Math.min(...values), max = Math.max(...values);
  return (
    <>
      <div className="chart-legend">
        {series.map((item) => <span key={item.symbol}><i style={{ background: item.color }} />{item.symbol}</span>)}
        <span>Indexed to 100 at the first displayed close</span>
      </div>
      <svg className="price-chart" viewBox="0 0 600 210" role="img" aria-label="Relative stock-price performance chart">
        {[0.2, 0.5, 0.8].map((ratio) => <line key={ratio} x1="18" x2="582" y1={210 * ratio} y2={210 * ratio} className="chart-grid" />)}
        {series.map((item) => <polyline key={item.symbol} points={line(item.points, start, end, min, max)} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
      </svg>
      <div className="chart-axis"><span>{chart.fromDate}</span><span>{chart.throughDate}</span></div>
    </>
  );
}

export function ClaimPriceChart({ claimId }: { claimId: string }) {
  const [chart, setChart] = useState<ClaimChart | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/claims/${claimId}/chart`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Price data is unavailable.");
      const result = claimChartResponseSchema.parse(body);
      if (!result.configured || !result.chart) throw new Error("Market data is not configured.");
      setChart(result.chart);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Price data is unavailable.");
      setState("unavailable");
    }
  }, [claimId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return (
    <section className="detail-panel claim-price-chart" aria-label="Massive price chart">
      <span className="eyebrow">MARKET DATA · MASSIVE</span>
      <h2>Relative price performance</h2>
      {state === "loading" && <p>Loading daily prices…</p>}
      {state === "ready" && chart && <Chart chart={chart} />}
      {state === "unavailable" && <p className="field-help">{message}</p>}
      <small>Split-adjusted daily closes. Dividends are excluded. This chart is visual context; saved resolution inputs determine the claim result.</small>
    </section>
  );
}
