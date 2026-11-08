import { CheckCircle2, CircleHelp, Clock3, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PriceSnapshot } from "@/features/market-data/contracts";
import type { ResolutionAttempt } from "@/features/resolution/contracts";
import {
  formatMetric,
  formatReplayTime,
  formatSessionDate,
  replayStatusLabels,
  replayTone,
} from "../presentation";
import { REPLAY_COVERAGE } from "../dataset";

function SnapshotRows({ snapshots, label }: { snapshots: PriceSnapshot[]; label: string }) {
  return snapshots.map((snapshot, index) => (
    <tr key={`${label}:${snapshot.id}`}>
      <th scope="row">
        {label} · {index === 0 ? "start" : "end"}
      </th>
      <td>{formatSessionDate(snapshot.sessionDate)}</td>
      <td className="numeric">
        {String(snapshot.value)}{" "}
        {snapshot.instrument.quote.kind === "yield"
          ? "% yield"
          : `${snapshot.instrument.quote.currency} / ${snapshot.instrument.quote.unit}`}
      </td>
      <td>{snapshot.observedAt.replace("T", " ").replace("Z", " UTC")}</td>
      <td>{snapshot.adjustment.replaceAll("_", " ")}</td>
    </tr>
  ));
}

export function ReplayResult({ attempt }: { attempt: ResolutionAttempt }) {
  if (attempt.status === "invalid_input")
    return (
      <section className="detail-panel result-panel" aria-labelledby="result-title">
        <Badge tone="amber">Invalid input</Badge>
        <h2 id="result-title">These inputs could not be evaluated.</h2>
        <ul>
          {attempt.issues.map((issue, index) => (
            <li key={`${issue.path}:${index}`}>
              {issue.path}: {issue.message}
            </li>
          ))}
        </ul>
      </section>
    );
  if (!("resolution" in attempt))
    return (
      <section className="detail-panel result-panel" aria-labelledby="result-title">
        <Badge tone={replayTone(attempt.status)}>{replayStatusLabels[attempt.status]}</Badge>
        <h2 id="result-title">
          <Clock3 size={23} aria-hidden="true" />
          The result stays pending.
        </h2>
        <p>{attempt.reason}</p>
        {attempt.window && (
          <dl className="result-window">
            <div>
              <dt>Selected start</dt>
              <dd>{formatSessionDate(attempt.window.startSessionDate)}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{formatSessionDate(attempt.window.targetDate)}</dd>
            </div>
            <div>
              <dt>Selected end</dt>
              <dd>
                {attempt.window.endSessionDate
                  ? formatSessionDate(attempt.window.endSessionDate)
                  : "Not covered yet"}
              </dd>
            </div>
          </dl>
        )}
        {attempt.missingObservations.length > 0 && (
          <div className="missing-observations">
            <strong>Required observations</strong>
            <ul>
              {attempt.missingObservations.map((missing) => (
                <li key={`${missing.instrumentId}:${missing.sessionDate}`}>
                  {missing.instrumentId} · {formatSessionDate(missing.sessionDate)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="result-caveat">
          <Info size={16} aria-hidden="true" />
          <span>
            This fixed synthetic dataset covers {REPLAY_COVERAGE} only. Missing observations stay
            missing; a later price cannot replace the saved test.
          </span>
        </div>
      </section>
    );
  const resolution = attempt.resolution;
  if (resolution.outcome === "unclear")
    return (
      <section className="detail-panel result-panel" aria-labelledby="result-title">
        <Badge tone="amber">Unclear</Badge>
        <h2 id="result-title">
          <CircleHelp size={23} aria-hidden="true" />A fair result is unavailable.
        </h2>
        <p>{resolution.reason}</p>
        <p className="muted">No win or miss is counted for this example.</p>
        <details className="audit-details">
          <summary>Inspect the resolution reason</summary>
          <code>{resolution.reasonCode}</code>
          <p>
            Calculated {formatReplayTime(resolution.calculatedAt)} · {resolution.formulaVersion}
          </p>
        </details>
      </section>
    );
  if (resolution.outcome === "unscored")
    return (
      <section className="detail-panel result-panel" aria-labelledby="result-title">
        <Badge>Unscored</Badge>
        <h2 id="result-title">A position statement has no performance score.</h2>
        <p>
          Keeping a position does not specify a market outcome. This hold stays in the replay
          history without becoming a win or a miss.
        </p>
        <p className="muted">
          No position or trade is verified, and no prices are required to reach this classification.
        </p>
      </section>
    );
  const { measurement, inputs, check } = resolution;
  const metricCards =
    measurement.kind === "price_return"
      ? [
          {
            label: `${inputs.assetStart.instrument.symbol} price return`,
            value: formatMetric(measurement.assetReturnPct),
          },
          ...(measurement.benchmarkReturnPct !== null
            ? [
                {
                  label: `${inputs.benchmark!.start.instrument.symbol} price return`,
                  value: formatMetric(measurement.benchmarkReturnPct),
                },
              ]
            : []),
          ...(measurement.excessReturnPp !== null
            ? [
                {
                  label: "Return versus benchmark",
                  value: formatMetric(measurement.excessReturnPp, " pp"),
                },
              ]
            : []),
        ]
      : measurement.kind === "yield_change"
        ? [
            {
              label: `${inputs.assetStart.instrument.symbol} yield change`,
              value: formatMetric(measurement.assetChangeBps, " bps"),
            },
            ...(measurement.benchmarkChangeBps !== null
              ? [
                  {
                    label: `${inputs.benchmark!.start.instrument.symbol} yield change`,
                    value: formatMetric(measurement.benchmarkChangeBps, " bps"),
                  },
                ]
              : []),
            ...(measurement.relativeChangeBps !== null
              ? [
                  {
                    label: "Relative yield change",
                    value: formatMetric(measurement.relativeChangeBps, " bps"),
                  },
                ]
              : []),
          ]
        : [
            {
              label: "Starting quote",
              value: `${measurement.startValue} ${measurement.unit.replace("percent_yield", "% yield")}`,
            },
            {
              label: "Ending quote",
              value: `${measurement.endValue} ${measurement.unit.replace("percent_yield", "% yield")}`,
            },
          ];
  return (
    <section className="detail-panel result-panel" aria-labelledby="result-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CALCULATED BY CODE</span>
          <h2 id="result-title">
            <CheckCircle2 size={23} aria-hidden="true" />
            {resolution.outcome === "met"
              ? "The saved test was met."
              : "The saved test was not met."}
          </h2>
        </div>
        <Badge tone={replayTone(resolution.outcome)}>
          {replayStatusLabels[resolution.outcome]}
        </Badge>
      </div>
      <p className="result-intro">
        Measured from the selected start to the selected review observation. These are fabricated
        values, not historical performance.
      </p>
      <div className="result-metrics">
        {metricCards.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <dl className="result-window">
        <div>
          <dt>Start</dt>
          <dd>{formatSessionDate(inputs.window.startSessionDate)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{formatSessionDate(inputs.window.targetDate)}</dd>
        </div>
        <div>
          <dt>Selected review</dt>
          <dd>{formatSessionDate(inputs.window.endSessionDate)}</dd>
        </div>
      </dl>
      <h3 className="table-heading">The calculation inputs</h3>
      <div
        className="table-scroll"
        role="region"
        aria-label="Saved calculation inputs"
        tabIndex={0}
      >
        <table className="audit-table">
          <caption>Exact saved values. Fixing times are shown explicitly in UTC.</caption>
          <thead>
            <tr>
              <th scope="col">Series</th>
              <th scope="col">Session</th>
              <th scope="col">Value & unit</th>
              <th scope="col">Fixing</th>
              <th scope="col">Adjustment</th>
            </tr>
          </thead>
          <tbody>
            <SnapshotRows
              label={inputs.assetStart.instrument.symbol}
              snapshots={[inputs.assetStart, inputs.assetEnd]}
            />
            {inputs.benchmark && (
              <SnapshotRows
                label={inputs.benchmark.start.instrument.symbol}
                snapshots={[inputs.benchmark.start, inputs.benchmark.end]}
              />
            )}
          </tbody>
        </table>
      </div>
      {check.kind === "comparison" ? (
        <div className="formula-panel">
          <span className="eyebrow">THE SAVED RULE</span>
          {measurement.kind === "price_return" ? (
            <>
              <p>
                Asset return = ({inputs.assetEnd.value} − {inputs.assetStart.value}) ÷{" "}
                {inputs.assetStart.value} × 100 = {formatMetric(measurement.assetReturnPct)}
              </p>
              {inputs.benchmark && (
                <p>
                  Benchmark return = ({inputs.benchmark.end.value} − {inputs.benchmark.start.value})
                  ÷ {inputs.benchmark.start.value} × 100 ={" "}
                  {formatMetric(measurement.benchmarkReturnPct!)}
                </p>
              )}
              <p>
                Asset return − benchmark return ={" "}
                <strong>{formatMetric(check.value, " pp")}</strong>
              </p>
            </>
          ) : (
            <>
              <p>Yield change = (ending yield − starting yield) × 100 basis points.</p>
              <p>
                Asset yield change − benchmark yield change ={" "}
                <strong>{formatMetric(check.value, " bps")}</strong>
              </p>
            </>
          )}
          <p className="muted">
            Outperform requires a strictly positive relative result; underperform requires a
            strictly negative one. Ties do not meet either test.
          </p>
        </div>
      ) : (
        <>
          <div className="formula-panel">
            <span className="eyebrow">INCLUSIVE BOUNDS</span>
            <p>
              {check.lower} ≤ measured {check.metric.replaceAll("_", " ")} ≤ {check.upper}
            </p>
            <p className="muted">
              Checked{" "}
              {check.evaluation === "at_review"
                ? "at the review observation only"
                : "at the start and every scheduled daily observation through review"}
              . Daily sampling does not establish what happened intraday.
            </p>
          </div>
          <div
            className="table-scroll"
            role="region"
            aria-label="Individual condition checks"
            tabIndex={0}
          >
            <table className="audit-table">
              <caption>Each observation tested against the committed bounds.</caption>
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Measured value</th>
                  <th scope="col">Condition</th>
                </tr>
              </thead>
              <tbody>
                {check.observations.map((observation) => (
                  <tr key={observation.snapshotId}>
                    <th scope="row">{formatSessionDate(observation.sessionDate)}</th>
                    <td className="numeric">{String(observation.value)}</td>
                    <td>
                      <Badge tone={observation.withinBounds ? "green" : "amber"}>
                        {observation.withinBounds ? "Within bounds" : "Outside bounds"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <details className="audit-details">
        <summary>Data provenance & calculation time</summary>
        <dl className="detail-list">
          <div>
            <dt>Source</dt>
            <dd>
              {inputs.assetStart.source.provider} · fabricated synthetic data. No market-data API
              was queried.
            </dd>
          </div>
          <div>
            <dt>Dataset and calendar</dt>
            <dd>
              {resolution.context.kind === "replay" ? resolution.context.datasetId : "Live"} ·{" "}
              {inputs.calendars.asset.id} / {inputs.calendars.asset.version}
            </dd>
          </div>
          <div>
            <dt>Calculated</dt>
            <dd>{formatReplayTime(resolution.calculatedAt)}</dd>
          </div>
          <div>
            <dt>Formula version</dt>
            <dd>{resolution.formulaVersion}</dd>
          </div>
          <div>
            <dt>Snapshot availability</dt>
            <dd>
              Start published {inputs.assetStart.availableAt}; retrieved{" "}
              {inputs.assetStart.retrievedAt}. End published {inputs.assetEnd.availableAt};
              retrieved {inputs.assetEnd.retrievedAt}.
            </dd>
          </div>
          <div>
            <dt>Adjustment basis</dt>
            <dd>{inputs.assetStart.adjustmentBasisId}</dd>
          </div>
        </dl>
      </details>
      <div className="result-caveat">
        <Info size={16} aria-hidden="true" />
        <span>
          Scores use unrounded saved inputs. Price performance excludes dividends. A yield change is
          not a bond return, and a numerical result does not establish why the market moved.
        </span>
      </div>
    </section>
  );
}
