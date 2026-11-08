# Part 8: evidence-grounded reasoning review

Reasoning review is intentionally separate from market-performance scoring. The author supplies dated evidence items with a source URL, publisher, excerpt, and retrieval time. Claude receives the saved assumptions and those evidence items, then returns an assessment for each assumption:

- `supported` when the supplied evidence directly supports it;
- `contradicted` when the supplied evidence directly conflicts with it;
- `unresolved` when the evidence is insufficient or ambiguous.

Application code rejects unknown assumption or evidence IDs, fills omitted assumptions as unresolved, and validates the final review contract. The review has no outcome, return, or score field and cannot change a saved resolution. Source links and excerpts are preserved as supplied; ProvenAlpha does not claim that a model-generated explanation proves causality.

The owner-only endpoint is `POST /api/claims/:id/review`. It requires a verified session, same-origin request, at least one saved assumption, and one to twelve evidence items. The server calls Claude, then persists the append-only payload through the trusted Supabase function created by migration `202611070004_reasoning_reviews.sql`.
