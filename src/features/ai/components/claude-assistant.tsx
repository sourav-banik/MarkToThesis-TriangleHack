"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConfirmedTerms } from "@/features/claims/contracts";
import { describePrediction, formatHorizon } from "@/features/claims/presentation";
import { parserResponseSchema, type ParserRequest, type ParserResponse } from "../parser-contracts";

type Props = { originalText: string; rationale: string; onApply: (terms: ConfirmedTerms) => void };
export function ClaudeAssistant(props: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/claims/parse", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Claude connection status could not be checked. Manual terms remain available.",
          );
        const body = await response.json();
        if (!controller.signal.aborted) setConfigured(body.configured === true);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Claude connection status could not be checked. Manual terms remain available.");
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="ai-panel" aria-label="Claude claim clarification">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CLARIFY WITH CLAUDE</span>
          <h2>Your view. Explicit terms.</h2>
        </div>
        <Sparkles size={21} aria-hidden="true" />
      </div>
      <p className="ai-intro">
        Claude extracts what you stated and asks for missing details. You review and edit the
        proposal before logging anything.
      </p>
      {error ? (
        <p role="alert" className="form-message error">
          {error}
        </p>
      ) : configured === null ? (
        <p role="status">Checking Claude connection…</p>
      ) : !configured ? (
        <div className="inline-note">
          <p>
            Claude is not connected yet. Define the terms manually while the API connection is
            configured.
          </p>
        </div>
      ) : (
        <ParserConversation
          key={JSON.stringify([props.originalText, props.rationale])}
          {...props}
        />
      )}
    </section>
  );
}

function ParserConversation({ originalText, rationale, onApply }: Props) {
  const [result, setResult] = useState<ParserResponse | null>(null);
  const [clarifications, setClarifications] = useState<ParserRequest["clarifications"]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function parse(next: ParserRequest["clarifications"]) {
    if (pending.current || !originalText.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/claims/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ originalText, rationale, clarifications: next }),
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok)
        throw new Error(
          body.error ?? "This call could not be parsed. Try again or define its terms manually.",
        );
      const parsed = parserResponseSchema.parse(body);
      if (parsed.draft.originalText !== originalText.trim())
        throw new Error(
          "This proposal belongs to a different draft. Parse your current call again.",
        );
      setResult(parsed);
      setClarifications(next);
      setAnswers({});
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Claude could not structure this call.");
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  const questions = result?.draft.clarificationQuestions ?? [];
  return (
    <>
      {!result && (
        <Button disabled={busy || !originalText.trim()} onClick={() => void parse([])}>
          <Sparkles size={14} aria-hidden="true" />
          {busy ? "Reading your call…" : "Make this call testable"}
        </Button>
      )}
      <p className="field-help">
        The original call, reasoning, and your clarification answers are sent to Anthropic when you
        request parsing. Nothing is published or saved by this action.
      </p>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="ai-proposal-status">
            <Badge tone="purple">
              {result.ready ? "Proposal ready for your review" : "More detail needed"}
            </Badge>
            <span>Claude · {result.model}</span>
          </div>
          {result.draft.proposedTerms.instrument && (
            <p className="ai-extracted">
              Instrument identified: <strong>{result.draft.proposedTerms.instrument.symbol}</strong>{" "}
              · {result.draft.proposedTerms.instrument.name}
            </p>
          )}
          {questions.length > 0 && (
            <form
              className="ai-questions"
              onSubmit={(event) => {
                event.preventDefault();
                const additions = questions.map((question) => ({
                  ...question,
                  answer: answers[question.field]?.trim() ?? "",
                }));
                if (additions.some((item) => !item.answer)) {
                  setError("Answer each question, or switch to manual terms.");
                  return;
                }
                if (clarifications.length + additions.length > 16) {
                  setError(
                    "This call needs further editing. Switch to manual terms or revise the original call to restart clarification.",
                  );
                  return;
                }
                void parse([...clarifications, ...additions]);
              }}
            >
              <h3>Make the missing terms explicit.</h3>
              {questions.map((question) => (
                <div className="field-group" key={question.field}>
                  <label htmlFor={`ai-answer-${question.field}`}>{question.question}</label>
                  <textarea
                    id={`ai-answer-${question.field}`}
                    rows={2}
                    maxLength={2000}
                    required
                    disabled={busy}
                    value={answers[question.field] ?? ""}
                    onChange={(event) =>
                      setAnswers((previous) => ({
                        ...previous,
                        [question.field]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <Button type="submit" disabled={busy}>
                {busy ? "Checking the clarified call…" : "Update proposal"}
              </Button>
            </form>
          )}
          {result.ready && result.terms && (
            <div className="ai-ready-proposal">
              <h3>A proposal, ready to edit.</h3>
              <p>
                <strong>{result.terms.instrument.symbol}</strong>:{" "}
                {describePrediction(result.terms)}
              </p>
              <dl className="detail-list">
                <div>
                  <dt>Horizon</dt>
                  <dd>{formatHorizon(result.terms.horizon)}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>
                    {result.terms.confidencePct === null
                      ? "Unstated"
                      : `${result.terms.confidencePct}%`}
                  </dd>
                </div>
                <div>
                  <dt>Reasoning</dt>
                  <dd>{result.terms.rationale || "Unstated"}</dd>
                </div>
              </dl>
              <p className="field-help">
                Daily fixing rules and dividend exclusion are platform conventions. Review the exact
                instrument, units, bounds, and measurement window in the editable form.
              </p>
              <Button onClick={() => onApply(result.terms!)} disabled={busy}>
                Use proposed terms
              </Button>
            </div>
          )}
          {result.warnings.map((warning) => (
            <p className="field-help" key={warning}>
              {warning}
            </p>
          ))}
        </>
      )}
    </>
  );
}
