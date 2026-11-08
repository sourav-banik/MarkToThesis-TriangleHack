# Part 5: public feed and author records

The public feed, owner history, and public author pages now share a database-backed browsing module. This increment builds on Part 4's tables and policies; no additional migration is needed.

## User flow

- `/` shows public live claims with author name/handle, instrument, condition, horizon, confidence at commitment, visibility, and logging date. Author links open `/u/[handle]`; each original call opens its locked detail page.
- `/profile` defaults to the signed-in owner's live record. The owner header offers profile editing and a link to the public profile. The live list includes that owner's public and private claims, with a visibility filter. A signed-out visitor must sign in to access it.
- `/u/[handle]` shows only calls committed as public, even when the browser belongs to the author. Its summary also excludes private claims. Missing authors return 404.
- `/profile?record=demo` explicitly selects the fictional author history. Synthetic wins, misses, and unresolved examples remain outside the live feed and counts.

Search matches a literal, case-insensitive substring of the original call. Asset, claim type, status, horizon unit, and owner-only visibility filters are combined on the server. Press **Apply filters** or Enter to load the result; **Reset** clears the controls and starts at the newest page. Horizon filtering uses the stored unit or target-date kind, not an approximate conversion between days, months, and years. Filter state is local to the current view, not encoded in its share URL.

Claims appear newest first, with UUID as the tie-breaker. **Load older claims** fetches 20 more using the original database timestamp's full precision. A page failure preserves already loaded calls and retries the same cursor. Incoming duplicates are ignored. **Refresh record** reloads the newest page. Changing filters starts a fresh list and cancels stale requests; an account-change event clears private records and summaries before fetching again.

Profile summaries use exact database counts across the complete visible history, independent of filters and pagination. They show total logged calls, awaiting-data calls, and unscored position stances. Counts are separate read queries and can briefly reflect different snapshots while another claim is committed. They are navigation context, not a transactional financial report.

Live market resolution is still a later module. The database currently creates measurable calls as `awaiting_start` and position-only holds as `unscored`. The live UI therefore offers those two status filters and does not invent accuracy, return, met/not-met, or skill statistics. Extend the read model, status filters, and summary together when persisted resolutions are integrated. The synthetic history continues to demonstrate wins and misses without attributing them to real users.

## Module boundaries

| Module                                               | Responsibility                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/features/feed/contracts.ts`                     | Filter/cursor validation, page DTOs, and literal search escaping               |
| `src/features/feed/server.ts`                        | Scoped database queries, joined safe author fields, pagination, and counts     |
| `src/features/feed/components/feed-filters.tsx`      | Search and filter controls                                                     |
| `src/features/claims/components/live-claim-list.tsx` | Cancellable loading, page merging, retries, empty states, and record rendering |
| `src/features/claims/components/live-claim-card.tsx` | Original call, exact condition, author link, confidence, and timestamp         |
| `src/features/profiles/server.ts`                    | Safe public author lookup shared by page and API                               |
| `src/features/profiles/components`                   | Owner identity/actions and full-record summary presentation                    |

The claim service still owns atomic commitment and persisted-version mapping. Feed code never calculates an outcome or writes a claim. AI, price retrieval, discussion, leaderboards, follows, and general forum behavior are outside this increment.

## API and privacy

`GET /api/claims` and `GET /api/authors/[handle]` accept:

| Parameter                | Values                                               |
| ------------------------ | ---------------------------------------------------- |
| `q`                      | Original-call search text, at most 120 characters    |
| `kind`                   | `all`, `outperform`, `underperform`, `hold`, `range` |
| `instrumentId`           | `all` or a canonical catalog ID                      |
| `status`                 | `all`, `awaiting_start`, `unscored`                  |
| `horizon`                | `all`, `days`, `months`, `years`, `date`             |
| `visibility`             | `all`, `public`, or owner-only `private`             |
| `beforeTime`, `beforeId` | Paired timestamp/UUID cursor                         |

`scope=mine` on `/api/claims` requires fresh verified authentication; the server derives the owner ID. A caller's `ownerId` query parameter does not select another owner. Public feed and author routes use an anonymous client. Both records and counts apply the same public/owner scope, backed by existing RLS. Responses disable caching. Public reads reject private filters instead of widening access.

Embedded claim-version filters use an inner join so nonmatching parent claims cannot return with empty versions. Literal text uses an escaped PostgREST `imatch` pattern; user text cannot supply a custom regular expression or change the surrounding filter syntax. See [Supabase filtering](https://supabase.com/docs/reference/javascript/using-filters) and [PostgREST operators](https://docs.postgrest.org/en/stable/references/api/tables_views.html#operators). Larger datasets may need dedicated search indexes; this increment does not add a ranking service.

## Validation

Unit tests exercise actual Supabase SDK request construction with a stub transport: embedded filters, safe author projection, public/owner scope, precise 20-record cursors, missing authors, full-history HEAD counts, and failures. Route tests verify that public reads use an anonymous client and owner queries derive identity from verified auth.

Browser fixtures test author/confidence display, server filter parameters, reset, failed-page retry without losing records, duplicate removal, full-history counts when filtering, mobile layout, and clearing private records after sign-out. The Playwright server explicitly clears Supabase settings so tests cannot depend on or write to the developer's real project. Fixture identities and claims are test data and are not inserted into Supabase.

Read-only local checks against the configured project verify real PostgREST filter syntax and the empty public feed. Complete authenticated saving/email confirmation still requires an actual signed-in account; browser mocks do not verify those hosted Auth flows.
