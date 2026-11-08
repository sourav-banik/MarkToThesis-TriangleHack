"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { claimChartResponseSchema, type ClaimChart } from "@/features/market-data/chart-contracts";
import { predictionOverlay } from "@/features/market-data/prediction-overlay";
import { describePrediction, formatHorizon } from "../presentation";
import type { ConfirmedTerms } from "../contracts";

const W = 820,
  H = 330,
  LEFT = 68,
  RIGHT = 18,
  TOP = 35,
  BOTTOM = 43;
const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export function PredictionPriceChart({
  chart,
  terms = chart.terms,
}: {
  chart: ClaimChart;
  terms?: ConfirmedTerms;
}) {
  const overlay = predictionOverlay(chart, terms);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const pendingReturnBase = overlay.mode === "return" && overlay.assetReference === null;
  const mode = pendingReturnBase ? "price" : overlay.mode;
  const baseline = mode === "price" ? null : overlay.assetReference;
  const asset = chart.asset.points.map((point) => ({
    ...point,
    plotted: mode === "price" ? point.value : baseline ? (point.value / baseline - 1) * 100 : null,
  }));
  const benchmark = (chart.benchmark?.points ?? []).map((point) => ({
    ...point,
    plotted:
      mode === "return" && overlay.benchmarkReference
        ? (point.value / overlay.benchmarkReference - 1) * 100
        : null,
  }));
  const usable = [...asset, ...benchmark].filter((point) => point.plotted !== null);
  const band = overlay.band && (overlay.band.unit === "price" || baseline) ? overlay.band : null;
  const values = [
    ...usable.map((point) => point.plotted!),
    ...(band ? [band.lower, band.upper] : []),
    ...(mode === "return" ? [0] : []),
  ];
  const minimum = Math.min(...values, ...(values.length ? [] : [0]));
  const maximum = Math.max(...values, ...(values.length ? [] : [1]));
  const padding = Math.max((maximum - minimum) * 0.12, mode === "price" ? 1 : 0.5);
  const min = minimum - padding,
    max = maximum + padding;
  const endDate = overlay.viewEnd;
  const from = timestamp(chart.fromDate),
    through = timestamp(endDate);
  const x = (date: string) =>
    LEFT + ((timestamp(date) - from) / Math.max(through - from, 86400000)) * (W - LEFT - RIGHT);
  const y = (value: number) => TOP + ((max - value) / (max - min)) * (H - TOP - BOTTOM);
  const points = (series: typeof asset) =>
    series
      .filter((point) => point.plotted !== null)
      .map((point) => `${x(point.date)},${y(point.plotted!)}`)
      .join(" ");
  const selected = asset.find((point) => point.date === selectedDate) ?? asset.at(-1);
  const selectedBenchmark = chart.benchmark?.points.find((point) => point.date === selected?.date);
  const prediction = terms.prediction;
  const comparison = prediction.kind === "outperform" || prediction.kind === "underperform";
  const bandStart = overlay.startDate ? Math.max(LEFT, x(overlay.startDate)) : x(chart.throughDate);
  const bandEnd = Math.min(W - RIGHT, x(overlay.reviewDate ?? overlay.targetDate ?? endDate));
  const futureX = Math.min(W - RIGHT, Math.max(LEFT, x(chart.throughDate)));
  const label = overlay.draft ? "Draft prediction chart" : "Published prediction chart";
  return (
    <div className="prediction-chart-content">
      <div className="prediction-chart-condition">
        <strong>
          {overlay.draft ? "Draft" : "Locked"} · {terms.instrument.symbol}
        </strong>
        <span>
          {describePrediction(terms)} · {formatHorizon(terms.horizon)}
        </span>
      </div>
      <div className="chart-legend">
        <span>
          <i style={{ background: "#6944ba" }} />
          {chart.asset.symbol}
        </span>
        {chart.benchmark && mode === "return" && (
          <span>
            <i style={{ background: "#a55814" }} />
            {chart.benchmark.symbol}
          </span>
        )}
        <span>
          {mode === "price"
            ? `Price (${terms.instrument.quote.kind === "price" ? terms.instrument.quote.currency : "quote"})`
            : "Price return (%)"}
        </span>
        <span>Shaded area: prediction window</span>
      </div>
      {chart.asset.points.length === 0 ? (
        <p>No completed daily closes are available yet. Your prediction terms remain visible.</p>
      ) : (
        <>
          {pendingReturnBase && (
            <p role="status" className="chart-start-pending">
              The starting close is pending or outside this chart window. The chart shows historical
              prices for context. Relative performance and a start-relative band appear when that
              exact session is available.
            </p>
          )}
          <div
            className="prediction-chart-scroll"
            role="region"
            aria-label="Scrollable prediction chart"
            tabIndex={0}
          >
            <svg
              className="prediction-price-svg"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={label}
              onPointerLeave={() => setSelectedDate(null)}
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const px = ((event.clientX - rect.left) / rect.width) * W;
                const date = from + ((px - LEFT) / (W - LEFT - RIGHT)) * (through - from);
                if (date > timestamp(chart.asset.points.at(-1)!.date) + 86400000) {
                  setSelectedDate(null);
                  return;
                }
                const closest = asset.reduce((best, point) =>
                  Math.abs(timestamp(point.date) - date) < Math.abs(timestamp(best.date) - date)
                    ? point
                    : best,
                );
                setSelectedDate(closest.date);
              }}
            >
              <title>
                {label}: {chart.asset.symbol} · {describePrediction(terms)}
              </title>
              <desc>
                Historical observations are solid lines. Future dates show only the stated
                prediction condition. No future prices are generated.
              </desc>
              <rect
                x={futureX}
                y={TOP}
                width={Math.max(0, W - RIGHT - futureX)}
                height={H - TOP - BOTTOM}
                fill="#f4effa"
              />
              <text x={futureX + 8} y={22} className="chart-svg-label">
                {futureX < W - RIGHT - 75 ? "Future window" : ""}
              </text>
              {band && bandEnd > bandStart && (
                <g data-testid="prediction-band">
                  <rect
                    x={bandStart}
                    y={y(band.upper)}
                    width={bandEnd - bandStart}
                    height={y(band.lower) - y(band.upper)}
                    fill="#dcf0e3"
                    opacity="0.8"
                  />
                  <line
                    x1={bandStart}
                    x2={bandEnd}
                    y1={y(band.upper)}
                    y2={y(band.upper)}
                    stroke="#287043"
                    strokeDasharray="6 4"
                  />
                  <line
                    x1={bandStart}
                    x2={bandEnd}
                    y1={y(band.lower)}
                    y2={y(band.lower)}
                    stroke="#287043"
                    strokeDasharray="6 4"
                  />
                  <text
                    x={bandStart + 8}
                    y={Math.max(TOP + 15, y(band.upper) - 8)}
                    className="chart-svg-label"
                  >
                    {number(band.lower)}–{number(band.upper)}
                    {mode === "return" ? "%" : ""} {band.daily ? "daily band" : "at review"}
                  </text>
                </g>
              )}
              {[0, 1, 2, 3, 4].map((step) => {
                const value = min + ((max - min) / 4) * step;
                return (
                  <g key={step}>
                    <line
                      x1={LEFT}
                      x2={W - RIGHT}
                      y1={y(value)}
                      y2={y(value)}
                      className="chart-grid"
                    />
                    <text
                      x={LEFT - 9}
                      y={y(value) + 4}
                      textAnchor="end"
                      className="chart-svg-label"
                    >
                      {number(value)}
                      {mode === "return" ? "%" : ""}
                    </text>
                  </g>
                );
              })}
              {asset.some((point) => point.plotted !== null) && (
                <polyline
                  data-testid="asset-price-line"
                  points={points(asset)}
                  fill="none"
                  stroke="#6944ba"
                  strokeWidth="2.8"
                />
              )}
              {benchmark.some((point) => point.plotted !== null) && (
                <polyline
                  data-testid="benchmark-price-line"
                  points={points(benchmark)}
                  fill="none"
                  stroke="#a55814"
                  strokeWidth="2.3"
                />
              )}
              {!overlay.draft && (
                <g data-testid="logged-marker">
                  <line
                    x1={x(overlay.loggingDate)}
                    x2={x(overlay.loggingDate)}
                    y1={TOP}
                    y2={H - BOTTOM}
                    stroke="#4c4659"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={Math.min(x(overlay.loggingDate) + 5, W - 100)}
                    y={TOP + 14}
                    className="chart-svg-label"
                  >
                    Logged
                  </text>
                </g>
              )}
              {(overlay.reviewDate ?? overlay.targetDate) &&
                x(overlay.reviewDate ?? overlay.targetDate!) <= W - RIGHT && (
                  <g data-testid="review-marker">
                    <line
                      x1={x(overlay.reviewDate ?? overlay.targetDate!)}
                      x2={x(overlay.reviewDate ?? overlay.targetDate!)}
                      y1={TOP}
                      y2={H - BOTTOM}
                      stroke="#287043"
                      strokeDasharray="6 4"
                    />
                    <text
                      x={Math.max(LEFT, x(overlay.reviewDate ?? overlay.targetDate!) - 7)}
                      y={TOP + 14}
                      textAnchor="end"
                      className="chart-svg-label"
                    >
                      Review
                    </text>
                  </g>
                )}
              {selectedDate && selected?.plotted !== null && selected?.plotted !== undefined && (
                <g>
                  <line
                    x1={x(selected.date)}
                    x2={x(selected.date)}
                    y1={TOP}
                    y2={H - BOTTOM}
                    stroke="#a5a0b3"
                  />
                  <circle cx={x(selected.date)} cy={y(selected.plotted)} r="4" fill="#6944ba" />
                </g>
              )}
              <text x={LEFT} y={H - 14} className="chart-svg-label">
                {chart.fromDate}
              </text>
              <text x={W - RIGHT} y={H - 14} textAnchor="end" className="chart-svg-label">
                {endDate}
              </text>
              {comparison && (
                <text
                  x={Math.min(Math.max(futureX + 10, LEFT + 10), W - 280)}
                  y={H - BOTTOM - 14}
                  className="chart-svg-label"
                  data-testid="comparison-condition"
                >
                  {chart.asset.symbol} return {prediction.kind === "outperform" ? ">" : "<"}{" "}
                  {chart.benchmark?.symbol} return at review
                </text>
              )}
            </svg>
          </div>
          {selected && (
            <div className="chart-price-readout" aria-live="polite">
              <strong>{selected.date}</strong>
              <span>
                {chart.asset.symbol}: {number(selected.value)}{" "}
                {terms.instrument.quote.kind === "price" ? terms.instrument.quote.currency : ""}
              </span>
              {selectedBenchmark && (
                <span>
                  {chart.benchmark?.symbol}: {number(selectedBenchmark.value)}
                </span>
              )}
              <span>{selectedDate ? "Selected daily close" : "Latest completed daily close"}</span>
            </div>
          )}
          <label className="chart-inspector">
            Inspect a historical close
            <input
              aria-label="Inspect historical prices"
              type="range"
              min={0}
              max={Math.max(0, asset.length - 1)}
              value={Math.max(
                0,
                selected ? asset.findIndex((point) => point.date === selected.date) : 0,
              )}
              onChange={(event) => setSelectedDate(asset[Number(event.target.value)].date)}
            />
          </label>
        </>
      )}
      <dl className="prediction-chart-dates">
        <div>
          <dt>{overlay.draft ? "Preview reference close" : "Measurement start"}</dt>
          <dd>
            {overlay.draft
              ? (overlay.referenceDate ?? "Unavailable")
              : (overlay.startDate ?? "Calendar pending")}
            {overlay.assetReference !== null && ` · ${number(overlay.assetReference)}`}
          </dd>
        </div>
        <div>
          <dt>{overlay.draft ? "Indicative review close" : "Review close"}</dt>
          <dd>{overlay.reviewDate ?? overlay.targetDate ?? "Calendar pending"}</dd>
        </div>
        <div>
          <dt>Sampling</dt>
          <dd>
            {band?.daily
              ? "Every daily close"
              : prediction.kind === "hold" && prediction.meaning.kind === "maintain_position"
                ? "Position stance · unscored"
                : "At review close"}
          </dd>
        </div>
      </dl>
      <p className="field-help">
        {overlay.draft
          ? "Draft overlay uses the latest completed close for illustration. Publishing locks the terms; the final start is the first eligible close after logging."
          : "This chart shows the saved prediction publicly when the claim is public. The final score comes from the resolver's saved observations."}{" "}
        {mode === "return" &&
          "Both lines use the same reference session; missing benchmark prices are not substituted."}
      </p>
      <small>
        {chart.adjustment === "unadjusted_quoted_price"
          ? "Unadjusted nominal prices for a quoted-price range."
          : "Split-adjusted daily closes. Dividends excluded."}{" "}
        Daily data is not a live tick quote. Future shading displays a condition, not a generated
        price forecast.
      </small>
    </div>
  );
}

function ChartLoader({ claimId, terms }: { claimId?: string; terms?: ConfirmedTerms }) {
  const [chart, setChart] = useState<ClaimChart | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const currentTerms = useRef(terms);
  useEffect(() => {
    currentTerms.current = terms;
  }, [terms]);
  const prediction = terms?.prediction;
  // Changing an overlay does not refetch identical historical prices.
  const sourceKey = JSON.stringify([
    terms?.instrument.id,
    prediction?.kind === "outperform" || prediction?.kind === "underperform"
      ? prediction.benchmark.id
      : null,
    prediction?.kind === "range" && prediction.metric === "quoted_value",
  ]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch(
            claimId ? `/api/claims/${claimId}/chart` : "/api/market-data/preview",
            {
              method: claimId ? "GET" : "POST",
              cache: "no-store",
              signal: controller.signal,
              ...(claimId
                ? {}
                : {
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ terms: currentTerms.current }),
                  }),
            },
          );
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "Daily prices are unavailable.");
          const result = claimChartResponseSchema.parse(body);
          if (!result.chart) throw new Error("Market data is not configured.");
          if (!controller.signal.aborted) setChart(result.chart);
        } catch (error) {
          if (!controller.signal.aborted) {
            setChart(null);
            setMessage((error as Error).message);
          }
        } finally {
          if (!controller.signal.aborted) setBusy(false);
        }
      },
      claimId ? 0 : 450,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [claimId, sourceKey, revision]);
  const correctSource =
    !terms ||
    (chart?.asset.symbol === terms.instrument.symbol &&
      chart.adjustment ===
        (prediction?.kind === "range" && prediction.metric === "quoted_value"
          ? "unadjusted_quoted_price"
          : "split_adjusted_price_return_excluding_dividends") &&
      chart.benchmark?.symbol ===
        (prediction?.kind === "outperform" || prediction?.kind === "underperform"
          ? prediction.benchmark.symbol
          : undefined));
  return (
    <section
      className="detail-panel claim-price-chart"
      aria-label={claimId ? "Published prediction price chart" : "Draft prediction price chart"}
    >
      <span className="eyebrow">
        MASSIVE DAILY PRICES · {claimId ? "SAVED PREDICTION" : "PRE-PUBLISH PREVIEW"}
      </span>
      <h2>Price and prediction</h2>
      {busy && <p role="status">Loading daily prices…</p>}
      {chart && correctSource && (
        <PredictionPriceChart chart={chart} terms={terms ?? chart.terms} />
      )}
      {message && (
        <p role="status" className="field-help">
          {message}
        </p>
      )}
      <Button variant="quiet" disabled={busy} onClick={() => setRevision((value) => value + 1)}>
        Refresh prices
      </Button>
    </section>
  );
}
export function DraftPredictionChart({ terms }: { terms: ConfirmedTerms }) {
  return <ChartLoader terms={terms} />;
}
export function ClaimPriceChart({ claimId }: { claimId: string }) {
  return <ChartLoader claimId={claimId} />;
}
