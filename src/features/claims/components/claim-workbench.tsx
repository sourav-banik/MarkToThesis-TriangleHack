"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Info, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { standardClaimFields as defaultTerms } from "../conventions";
import { instrumentCatalog, instruments } from "@/features/market-data/catalog";
import { commitmentTermsSchema, type ConfirmedTerms, type Prediction } from "../contracts";
import { predictionLabels } from "../presentation";
import { ClaimSummary } from "./claim-summary";

const kinds = ["outperform", "underperform", "hold", "range"] as const;
const numberValue = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

export function ClaimWorkbench({
  initialTerms,
  onReview,
  purpose = "replay",
}: {
  initialTerms?: ConfirmedTerms;
  onReview?: (terms: ConfirmedTerms) => void;
  purpose?: "replay" | "live";
}) {
  const initialPrediction = initialTerms?.prediction;
  const [kind, setKind] = useState<Prediction["kind"]>(initialPrediction?.kind ?? "outperform");
  const [instrumentId, setInstrumentId] = useState(
    initialTerms?.instrument.id ?? instruments.aapl.id,
  );
  const [benchmarkId, setBenchmarkId] = useState(
    initialPrediction?.kind === "outperform" || initialPrediction?.kind === "underperform"
      ? initialPrediction.benchmark.id
      : instruments.spy.id,
  );
  const [holdMeaning, setHoldMeaning] = useState<string>(
    initialPrediction?.kind === "hold" ? initialPrediction.meaning.kind : "neutral",
  );
  const [horizonMode, setHorizonMode] = useState<string>(initialTerms?.horizon.kind ?? "duration");
  const [duration, setDuration] = useState(
    initialTerms?.horizon.kind === "duration" ? String(initialTerms.horizon.value) : "3",
  );
  const [unit, setUnit] = useState<string>(
    initialTerms?.horizon.kind === "duration" ? initialTerms.horizon.unit : "months",
  );
  const [targetDate, setTargetDate] = useState(
    initialTerms?.horizon.kind === "date" ? initialTerms.horizon.targetDate : "",
  );
  const [lower, setLower] = useState(
    initialPrediction?.kind === "range" ? String(initialPrediction.lower) : "100",
  );
  const [upper, setUpper] = useState(
    initialPrediction?.kind === "range" ? String(initialPrediction.upper) : "200",
  );
  const [rangeMetric, setRangeMetric] = useState<string>(
    initialPrediction?.kind === "range" ? initialPrediction.metric : "quoted_value",
  );
  const [tolerance, setTolerance] = useState(
    initialPrediction?.kind === "hold" && initialPrediction.meaning.kind === "neutral"
      ? String(initialPrediction.meaning.tolerance)
      : "5",
  );
  const [evaluation, setEvaluation] = useState<string>(
    initialPrediction?.kind === "range"
      ? initialPrediction.evaluation
      : initialPrediction?.kind === "hold" && initialPrediction.meaning.kind === "neutral"
        ? initialPrediction.meaning.evaluation
        : "at_review",
  );
  const [confidence, setConfidence] = useState(
    initialTerms?.confidencePct == null ? "" : String(initialTerms.confidencePct),
  );
  const [checked, setChecked] = useState(false);
  const instrument = instrumentCatalog.find((item) => item.id === instrumentId)!;
  const benchmark = instrumentCatalog.find((item) => item.id === benchmarkId);
  const isYield = instrument.quote.kind === "yield";
  const isComparison = kind === "outperform" || kind === "underperform";
  const benchmarks = instrumentCatalog.filter(
    (item) =>
      item.id !== instrument.id &&
      item.quote.kind === instrument.quote.kind &&
      (item.quote.kind !== "price" ||
        instrument.quote.kind !== "price" ||
        item.quote.currency === instrument.quote.currency),
  );

  const prediction = isComparison
    ? { kind, benchmark, metric: isYield ? "yield_change_bps" : "price_return" }
    : kind === "range"
      ? {
          kind,
          lower: numberValue(lower),
          upper: numberValue(upper),
          metric: rangeMetric,
          boundaries: "inclusive",
          evaluation,
        }
      : {
          kind,
          meaning:
            holdMeaning === "maintain_position"
              ? { kind: "maintain_position" }
              : {
                  kind: "neutral",
                  tolerance: numberValue(tolerance),
                  metric: isYield ? "yield_change_bps" : "price_return_pct",
                  evaluation,
                },
        };
  const result = commitmentTermsSchema.safeParse({
    ...defaultTerms,
    ...initialTerms,
    instrument,
    prediction,
    horizon:
      horizonMode === "date"
        ? { kind: "date", targetDate }
        : { kind: "duration", value: numberValue(duration), unit },
    confidencePct: confidence.trim() === "" ? null : numberValue(confidence),
  });

  function changeInstrument(id: string) {
    const next = instrumentCatalog.find((item) => item.id === id)!;
    setInstrumentId(id);
    setRangeMetric("quoted_value");
    const candidate = instrumentCatalog.find(
      (item) => item.id !== id && item.quote.kind === next.quote.kind,
    );
    setBenchmarkId(candidate?.id ?? "");
    setLower(next.quote.kind === "yield" ? "3.5" : next.symbol === "BTC/USD" ? "80000" : "100");
    setUpper(next.quote.kind === "yield" ? "4.5" : next.symbol === "BTC/USD" ? "120000" : "200");
    setChecked(false);
  }

  return (
    <div className="workbench-grid">
      <form
        className="form-panel"
        onSubmit={(event) => {
          event.preventDefault();
          setChecked(true);
          if (result.success) onReview?.(result.data);
        }}
        onChange={() => setChecked(false)}
        noValidate
      >
        <div className="panel-heading">
          <span className="step-number">01</span>
          <div>
            <h2>Give your view a shape</h2>
            <p>Explore the terms that make a claim inspectable.</p>
          </div>
        </div>
        <fieldset className="field-group">
          <legend>What kind of call?</legend>
          <div className="kind-options">
            {kinds.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                className={kind === value ? "selected" : ""}
                onClick={() => {
                  setKind(value);
                  setChecked(false);
                }}
              >
                {predictionLabels[value]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field-group">
          <label htmlFor="instrument">Instrument</label>
          <select
            id="instrument"
            value={instrumentId}
            onChange={(event) => changeInstrument(event.target.value)}
          >
            {instrumentCatalog.map((item) => (
              <option value={item.id} key={item.id}>
                {item.symbol} · {item.name}
              </option>
            ))}
          </select>
          <p className="field-help">
            Starter examples across asset classes. Live Massive coverage currently applies to U.S.
            stocks and ETFs; other identities remain explicitly bounded until their provider is defined.
          </p>
        </div>
        {isComparison && (
          <div className="field-group">
            <label htmlFor="benchmark">Comparison benchmark</label>
            <select
              id="benchmark"
              value={benchmarkId}
              onChange={(event) => setBenchmarkId(event.target.value)}
            >
              <option value="">Choose a compatible benchmark</option>
              {benchmarks.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.symbol} · {item.name}
                </option>
              ))}
            </select>
            {benchmarks.length === 0 && (
              <p className="field-help">
                This catalog has no second yield series. Select a range or hold, or add a precisely
                identified yield benchmark in a later integration.
              </p>
            )}
          </div>
        )}
        {kind === "hold" && (
          <div className="field-group">
            <label htmlFor="hold-meaning">What does “hold” mean?</label>
            <select
              id="hold-meaning"
              value={holdMeaning}
              onChange={(event) => setHoldMeaning(event.target.value)}
            >
              <option value="neutral">Stay within a measurable tolerance</option>
              <option value="maintain_position">I would keep my position · unscored</option>
            </select>
            {holdMeaning === "neutral" ? (
              <div className="nested-field">
                <label htmlFor="tolerance">
                  Tolerance from starting value ({isYield ? "basis points" : "% price return"})
                </label>
                <input
                  id="tolerance"
                  type="number"
                  min="0"
                  step="any"
                  value={tolerance}
                  onChange={(event) => setTolerance(event.target.value)}
                />
              </div>
            ) : (
              <p className="field-help">
                A position statement has no market-performance outcome. MarkToThesis does not verify
                that a position exists.
              </p>
            )}
          </div>
        )}
        {kind === "range" && (
          <div className="field-group">
            <label htmlFor="range-metric">Range units</label>
            <select
              id="range-metric"
              value={rangeMetric}
              onChange={(event) => setRangeMetric(event.target.value)}
            >
              <option value="quoted_value">{isYield ? "Yield level (%)" : "Quoted price"}</option>
              <option value={isYield ? "yield_change_bps" : "price_return_pct"}>
                {isYield ? "Yield change (basis points)" : "Price return (%)"}
              </option>
            </select>
            <span className="field-label">
              Inclusive range (
              {rangeMetric === "price_return_pct"
                ? "% price return"
                : rangeMetric === "yield_change_bps"
                  ? "basis points change"
                  : instrument.quote.kind === "yield"
                    ? "% yield"
                    : `${instrument.quote.currency} / ${instrument.quote.unit}`}
              )
            </span>
            <div className="form-row">
              <div>
                <label htmlFor="lower">Lower bound</label>
                <input
                  id="lower"
                  type="number"
                  step="any"
                  value={lower}
                  onChange={(event) => setLower(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="upper">Upper bound</label>
                <input
                  id="upper"
                  type="number"
                  step="any"
                  value={upper}
                  onChange={(event) => setUpper(event.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        {(kind === "range" || (kind === "hold" && holdMeaning === "neutral")) && (
          <div className="field-group">
            <label htmlFor="evaluation">When should the condition hold?</label>
            <select
              id="evaluation"
              value={evaluation}
              onChange={(event) => setEvaluation(event.target.value)}
            >
              <option value="at_review">At the review observation</option>
              <option value="every_daily_observation">
                At every daily observation in the window
              </option>
            </select>
            <p className="field-help">
              Daily observations do not establish that a range held throughout every intraday move.
            </p>
          </div>
        )}
        <div className="field-group">
          <label htmlFor="horizon-mode">Review horizon</label>
          <select
            id="horizon-mode"
            value={horizonMode}
            onChange={(event) => setHorizonMode(event.target.value)}
          >
            <option value="duration">A duration from the starting observation</option>
            <option value="date">A specific target date</option>
          </select>
          {horizonMode === "date" ? (
            <div className="nested-field">
              <label htmlFor="target-date">Target date</label>
              <input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
              <p className="field-help">
                A real commitment must validate that this date follows its logging time. No
                timestamp is created in this preview.
              </p>
            </div>
          ) : (
            <div className="form-row nested-field">
              <div>
                <label htmlFor="duration">Duration</label>
                <input
                  id="duration"
                  type="number"
                  min="1"
                  step="1"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="duration-unit">Calendar unit</label>
                <select
                  id="duration-unit"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="field-group">
          <label htmlFor="confidence">
            Confidence (%) <span className="muted normal-weight">· optional</span>
          </label>
          <input
            id="confidence"
            type="number"
            min="0"
            max="100"
            step="any"
            placeholder="Leave blank if unstated"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          />
        </div>
        <div className="form-actions">
          <Button type="submit">
            {onReview
              ? purpose === "live"
                ? "Review live claim"
                : "Review replay terms"
              : "Check the format"}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
          <span>
            {onReview
              ? purpose === "live"
                ? "Review before saving. The database supplies the timestamp."
                : "Review before locking. No public post is created."
              : "Preview only. Nothing is saved."}
          </span>
        </div>
        {checked && (
          <div
            className={result.success ? "form-message success" : "form-message error"}
            role="status"
          >
            {result.success ? (
              <>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>
                  The format is valid. Your preview has not been published or timestamped.
                </span>
              </>
            ) : (
              <div>
                <strong>A few terms need attention.</strong>
                <ul>
                  {[...new Set(result.error.issues.map((issue) => issue.message))].map(
                    (message) => (
                      <li key={message}>{message}</li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>
      <aside className="workbench-preview">
        <div className="section-heading">
          <span className="eyebrow">YOUR CLAIM, AT A GLANCE</span>
          <Badge tone="purple">Draft preview</Badge>
        </div>
        {result.success ? (
          <ClaimSummary terms={result.data} />
        ) : (
          <div className="preview-placeholder">
            <Info size={25} aria-hidden="true" />
            <h2>Make the terms explicit.</h2>
            <p>
              Complete the fields to see a structured preview. Use “Check the format” to inspect
              what is missing.
            </p>
          </div>
        )}
        <div className="aside-card compact">
          <LockKeyhole size={20} className="purple-text" aria-hidden="true" />
          <h3>A preview is not a commitment.</h3>
          <p>
            {onReview
              ? purpose === "live"
                ? "Review original wording, terms, and visibility before saving. Committed calls cannot be overwritten or hidden; a changed forecast creates a separate linked claim."
                : "Review the original wording and exact terms before locking a tab-local replay. Its browser confirmation time is separate from the simulated market dates."
              : "Publishing will lock the original wording, measurement rules, and server timestamp. That workflow comes in a later increment."}
          </p>
        </div>
        <div className="aside-footnote">
          <span className="eyebrow">MEASUREMENT MATTERS</span>
          <p>
            {isYield
              ? "Yield levels are expressed in percent; yield changes use basis points. Neither is the return on a bond investment."
              : "Price performance excludes dividends. The shared model reserves a separate dividend-inclusive methodology for a later increment."}
          </p>
        </div>
      </aside>
    </div>
  );
}
