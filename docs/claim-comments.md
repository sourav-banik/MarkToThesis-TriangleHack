# Part 9: claim-level discussion

Comments are attached to a single committed claim. They are not a general forum, cannot amend the original wording, and do not influence the deterministic resolution or Claude reasoning review.

The comments table is append-only. Public claims expose their comments to everyone; private claims expose them only to the owner. Signed-in users can comment on public claims, while only the owner can comment on a private claim. The API derives the author from the verified Supabase session and applies the same visibility policy in Postgres.

The endpoints are:

- `GET /api/claims/:id/comments` — list up to 100 comments in chronological order.
- `POST /api/claims/:id/comments` — add a 1–2,000 character comment.

Apply `202611070005_claim_comments.sql` after the previous migrations. Comments retain the author profile and database timestamp; deleting or editing them is intentionally not supported in this increment.
