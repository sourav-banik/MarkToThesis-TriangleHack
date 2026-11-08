# MarkToThesis

An AI-powered platform for making clear market claims and building a transparent record of their outcomes.

## Current increment: MVP hardening and Base Sepolia history proofs

Start with [MVP acceptance and setup](docs/mvp-acceptance.md). This audit adds robust complex-call clarification, an active claim-discussion feed, a real-price historical walkthrough at `/demo`, and independently checked Base Sepolia hash receipts. Apply migration `202611080006_mvp_integrity.sql` after migrations 001–005 before anchoring records. Anchoring requires an author's wallet confirmation and test ETH; records are never labeled confirmed solely because a transaction was submitted.

This repository contains the Next.js foundation, shared domain contracts, a deterministic resolution engine, a tab-local synthetic replay, Supabase authentication and persistent commitment, public/owner records, Claude-powered claim parsing, and a Massive-backed live resolver. The preview runs without API keys; Supabase enables live accounts, an Anthropic API key enables authenticated AI clarification, and Massive enables live stock/ETF observations.

Included:

- Responsive application shell, navigation, reusable UI, and loading/error/empty states.
- Illustrative claim feed, claim-format workbench, instrument browser, example detail pages, and separate synthetic/live author records.
- Contracts for drafts, confirmed terms, committed versions, observations, resolutions, evidence, and reasoning reviews.
- Outperform, underperform, range, and both meanings of hold.
- Broad instrument identities, yield-aware units, flexible horizons, and a reserved dividend-inclusive return convention.
- Calendar-based measurement-window selection, exact decimal scoring, reproducible calculation inputs, and explicit pending/unclear states.
- Synthetic resolution fixtures and tests for comparisons, neutral holds, unscored position statements, and endpoint/daily ranges.
- Replay draft, reasoning, explicit review, tab-local confirmation, resolver-backed result tables, and fictional author history containing wins and misses.
- Email/password account routes, confirmation callback, public profile editing, and server-verified session access.
- Atomic database-timestamped commitments, owner/private RLS, append-only terms, and idempotent retries.
- Separate public live feed, owner history, public author pages, and saved-claim details.
- Server-side search and filters, author/confidence details, precise cursor pagination, resilient page retries, and full-history profile summaries.
- Claude structured extraction, missing-term questions, source-checked proposals, editable prefilling, and required review before commitment.
- Massive daily bars, split-adjusted price normalization, NYSE session calendars, deterministic live resolution, and trusted append-only persistence.
- Evidence-grounded Claude reviews of saved assumptions, with source links retained separately from numerical outcomes.
- Claim-level discussion with immutable comments, visibility-aware RLS, and no effect on claim terms or scores.
- Simplified live demo: account entry, Claude-assisted submission, a saved-outcome scorecard, and Massive relative-price charts.

Follow [the connection and persistence guide](docs/persistence.md) to configure Supabase, [the Claude parser guide](docs/claude-parser.md) to enable AI clarification, and [the reasoning review guide](docs/reasoning-review.md) for evidence review. Missing keys produce setup states and manual entry remains available. Claim-level comments refresh automatically. Measurable live commitments await their starting observations; position-only holds are unscored. Supported stocks and ETFs use Massive; other measurable live forecasts remain blocked until their exact provider/fixing is implemented.

Replay confirmation uses the browser clock and `sessionStorage`, not a server timestamp or immutable database record. All replay prices and prior outcomes are fabricated examples. Replay records remain separate from real accounts and live tables.

## Try the complete replay

Open `/replay`, or choose **Start replay** on the feed:

1. Keep or replace the vague original call; optionally add reasoning and what would change your view.
2. Manually specify the instrument, prediction, horizon, and optional confidence. Replay remains manual; Claude clarification is available in the signed-in live-claim flow.
3. Review the original wording and exact measurement terms. Edit before confirming if needed.
4. Confirm and lock a copy in this tab. Browser confirmation time stays separate from the January 2024 simulated market dates.
5. Run resolution. The Part 2 engine supplies the result, input table, saved rules, and daily checks.
6. Open the fictional demo author's history and see the new replay beside synthetic met, missed, unclear, pending, and unscored examples.

The default three-day replay produces +10% asset return, +5% benchmark return, and +5 percentage points excess. The UI dataset is `synthetic-ui-v1`, with fabricated observations dated January 2–10, 2024. Longer horizons can remain pending rather than borrowing later prices. Reloads in the same tab restore confirmed replays; storage failures are disclosed and fall back to memory. Closing the tab or clearing its storage can lose them. Replay URLs are tab-local, not public share links. See [replay behavior and limitations](docs/replay.md).

## Browse live records

Once Supabase is configured, public calls appear on `/`. Search original wording, combine asset/type/status/horizon filters, and load older pages. Author links open `/u/[handle]`; `/profile` shows the signed-in owner's public and private calls. Profile summaries cover the full visible history, regardless of filters. See [Part 5 behavior and boundaries](docs/feed-and-records.md).

## Resolve a live claim with Massive

Part 7 supports U.S. stocks and ETFs whose exact committed provider binding is `massive`. Set `MASSIVE_API_KEY` and either the current `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, then apply `supabase/migrations/202611070003_massive_resolution.sql`. The claim owner can use **Resolve with live data** on a saved claim. Massive daily bars are split-adjusted for price performance; dividends remain excluded by the saved convention. Treasury yields, WTI spot, gold spot, and crypto remain explicit catalog identities but need their own exact provider adapters before live commitment.

## Review reasoning with evidence

Part 8 adds `supabase/migrations/202611070004_reasoning_reviews.sql`. Apply it after the previous migrations. On a committed claim with saved assumptions, the owner can attach dated source excerpts and run a Claude review. The model may label assumptions supported, contradicted, or unresolved only from those supplied evidence items. Reviews are append-only and never write or alter the Massive performance resolution.

## Run the simple live demo

Sign in at `/account`, log a Claude-assisted claim from `/new`, and open `/profile` for the live scorecard. The scorecard shows logged calls, scored calls, met/not-met totals, and met rate from saved deterministic resolutions only. Each supported stock/ETF claim page includes a Massive relative-price chart; it is visual context only and does not rewrite the stored resolution. See [the live demo flow](docs/live-demo.md).

## Clarify a call with Claude

Set `ANTHROPIC_API_KEY` in `.env.local`, restart the app, sign in, and open `/new`. Enter a call, select **Make this call testable**, answer missing-term questions, and **Use proposed terms** to prefill an editable form. Review and confirm separately to save. `ANTHROPIC_MODEL` optionally changes the model; the default is `claude-haiku-4-5-20251001`. No Gemini integration is used. See [Part 6 setup, behavior, and limitations](docs/claude-parser.md).

## Local setup

Use Node.js 24 LTS and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Leave credentials empty to explore the preview. When ready, copy `.env.example` to `.env.local`, apply migrations `202611070001` through `202611070005` in order, and set the exact `APP_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` following [the setup guide](docs/persistence.md). Keep provider secrets on the server; never add a `NEXT_PUBLIC_` prefix to secrets.

## Checks

```sh
npm run check
npm run build
```

The tests cover contract validation and deterministic financial calculations, including ties, inclusive bounds, daily breaches, calendar alignment, month ends, leap years, missing prices, publication delays, split bases, replay timestamps, and evidence references. They also verify account authorization, strict mutation input, origin/cache boundaries, commitment RPC behavior, and safe persistence failures. Run just the engine checks with `npm run test:resolution`.

Claude parsing tests use fixtures. For two real, billable API checks with synthetic calls, run `npm run check:claude` after configuring the key. This command never saves a claim.

Run `npm run test:database` with installed PostgreSQL binaries to test the actual migrations, privacy policies, append-only protections, rollback, and concurrent retries in a fresh disposable local cluster. See [database validation and its limits](docs/persistence.md#validation). No Supabase credentials or existing database are used.

The engine entry point is `resolveClaim` in `src/features/resolution/resolve.ts`. Supply a committed claim version, a stable resolution ID, an explicit `asOf` timestamp, independently supplied observation schedules, and price/yield snapshots. `syntheticResolutionRequest()` in `src/demo/resolution.ts` supplies a fabricated replay request: asset +10%, benchmark +5%, excess +5 percentage points, outcome met. It is not real historical market data. Position-only holds require only the claim, ID, and clock; they remain unscored without fetching prices.

See [the resolution rules and input contract](docs/resolution.md) before integrating a provider or UI.

Browser smoke tests run against the production build on port 3100:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

If a compatible Chrome or Edge is already installed, set `PLAYWRIGHT_CHANNEL=chrome` or `PLAYWRIGHT_CHANNEL=msedge` instead of downloading Chromium. Browser tests check replay, workspace screens, accounts, live review, feed filters/pagination, profile summaries, and clearing owner records on sign-out. The browser test server clears Supabase settings and uses explicit fixtures for live records. Real sign-in and email confirmation still need a connected-project check. Screenshots and failure traces are written to the ignored `test-results` directory.

## Modules

| Location                   | Responsibility                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `src/app`                  | Thin routes, layouts, global styles, route states                                    |
| `src/components`           | Shared UI and navigation                                                             |
| `src/features/claims`      | Claim contracts, workbench, live commitment service, and record presentation         |
| `src/features/auth`        | Account contracts, verified sessions, and account UI                                 |
| `src/features/market-data` | Instrument catalog, observation contracts, adapter boundary                          |
| `src/features/resolution`  | Calendar selection, exact arithmetic, data validation, and deterministic resolution  |
| `src/features/replay`      | Versioned synthetic dataset, validated tab store, confirmation, results, and history |
| `src/features/ai`          | Claude adapter, grounded proposal validation, clarification UI, and evidence reviews |
| `src/features/comments`    | Claim-level comment contracts, visibility-aware reads, and authenticated writes      |
| `src/features/feed`        | Scoped live queries, filters, cursor pagination, summaries, and example feed         |
| `src/features/profiles`    | Safe author lookup, owner profile header, and record summaries                       |
| `src/lib/server`           | Server-only configuration, Supabase clients, and HTTP boundaries                     |
| `supabase`                 | Database migrations and SQL policy/commitment tests                                  |
| `src/demo`                 | Clearly labeled claim examples and fabricated resolution fixtures                    |

Read [the domain rules and module boundaries](docs/architecture.md) before adding services. Parts 4–6 connect persistent commitment, records, and Claude clarification. Live price resolution remains a separate increment. Keep browser-only replay records out of prospective public statistics.
