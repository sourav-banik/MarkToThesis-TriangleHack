"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { Comment } from "@/features/comments/contracts";

export function ClaimComments({ claimId, canComment = false }: { claimId: string; canComment?: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "sending" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/claims/${claimId}/comments`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Comments are unavailable.");
      setComments(result.comments ?? []);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Comments are unavailable.");
      setState("error");
    }
  }, [claimId]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setState("sending");
    setMessage("");
    try {
      const response = await fetch(`/api/claims/${claimId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The comment could not be saved.");
      setComments((current) => [...current, result]);
      setBody("");
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The comment could not be saved.");
      setState("error");
    }
  }

  return (
    <section className="detail-panel claim-comments" aria-label="Claim discussion">
      <span className="eyebrow">DISCUSSION ATTACHED TO THIS CLAIM</span>
      <h2>Evidence and responses</h2>
      <p className="field-help">Comments add context but never change the locked terms, resolution, or reasoning review.</p>
      {state === "loading" ? <p>Loading discussion…</p> : comments.length === 0 ? <p>No comments yet.</p> : (
        <div className="comment-list">
          {comments.map((comment) => (
            <article className="comment" key={comment.id}>
              <div className="comment-meta"><strong>{comment.author.displayName}</strong><span>@{comment.author.handle}</span><time dateTime={comment.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}</time></div>
              <p>{comment.body}</p>
            </article>
          ))}
        </div>
      )}
      {canComment ? (
        <form onSubmit={submit} className="comment-form">
          <label htmlFor="claim-comment">Add a comment</label>
          <textarea id="claim-comment" maxLength={2000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share relevant evidence or a question about this call." />
          <button className={buttonClass("primary")} disabled={state === "sending" || !body.trim()}>{state === "sending" ? "Posting…" : "Post comment"}</button>
        </form>
      ) : null}
      {message && <p className="form-error">{message}</p>}
    </section>
  );
}
