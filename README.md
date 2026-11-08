# ProvenAlpha

An AI-powered platform for making clear market claims and building a transparent record of their outcomes.

## Current increment: Part 4

This repository contains the Next.js foundation, shared domain contracts, a deterministic resolution engine, a complete tab-local synthetic replay flow, and prepared Supabase authentication and persistent commitment. The preview runs without API keys; connect Supabase later to enable accounts and live records.

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

Supabase is intentionally unconfigured for now. Follow [the connection and persistence guide](docs/persistence.md) when ready; the app does not simulate successful sign-in or server saves. AI parsing, market-data retrieval, live resolution, and comments are not connected. Measurable live commitments await their starting observations; position-only holds are unscored. Selected instruments have fixed source bindings; other measurable live forecasts remain blocked until their exact provider/fixing is defined.

Replay confirmation uses the browser clock and `sessionStorage`, not a server timestamp or immutable database record. All replay prices and prior outcomes are fabricated examples. Replay records remain separate from real accounts and live tables.

## Try the complete replay

Open `/replay`, or choose **Start replay** on the feed:

1. Keep or replace the vague original call; optionally add reasoning and what would change your view.
2. Manually specify the instrument, prediction, horizon, and optional confidence. AI clarification is not connected yet.
3. Review the original wording and exact measurement terms. Edit before confirming if needed.
4. Confirm and lock a copy in this tab. Browser confirmation time stays separate from the January 2024 simulated market dates.
5. Run resolution. The Part 2 engine supplies the result, input table, saved rules, and daily checks.
6. Open the fictional demo author's history and see the new replay beside synthetic met, missed, unclear, pending, and unscored examples.

The default three-day replay produces +10% asset return, +5% benchmark return, and +5 percentage points excess. The UI dataset is `synthetic-ui-v1`, with fabricated observations dated January 2–10, 2024. Longer horizons can remain pending rather than borrowing later prices. Reloads in the same tab restore confirmed replays; storage failures are disclosed and fall back to memory. Closing the tab or clearing its storage can lose them. Replay URLs are tab-local, not public share links. See [replay behavior and limitations](docs/replay.md).

## Local setup

Use Node.js 24 LTS and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Leave credentials empty to explore the preview. When ready, copy `.env.example` to `.env.local`, apply the two migrations, and set the exact `APP_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` following [the setup guide](docs/persistence.md). Keep provider secrets on the server; never add a `NEXT_PUBLIC_` prefix to secrets.

## Checks

```sh
npm run check
npm run build
```

The tests cover contract validation and deterministic financial calculations, including ties, inclusive bounds, daily breaches, calendar alignment, month ends, leap years, missing prices, publication delays, split bases, replay timestamps, and evidence references. They also verify account authorization, strict mutation input, origin/cache boundaries, commitment RPC behavior, and safe persistence failures. Run just the engine checks with `npm run test:resolution`.

Run `npm run test:database` with installed PostgreSQL binaries to test the actual migrations, privacy policies, append-only protections, rollback, and concurrent retries in a fresh disposable local cluster. See [database validation and its limits](docs/persistence.md#validation). No Supabase credentials or existing database are used.

The engine entry point is `resolveClaim` in `src/features/resolution/resolve.ts`. Supply a committed claim version, a stable resolution ID, an explicit `asOf` timestamp, independently supplied observation schedules, and price/yield snapshots. `syntheticResolutionRequest()` in `src/demo/resolution.ts` supplies a fabricated replay request: asset +10%, benchmark +5%, excess +5 percentage points, outcome met. It is not real historical market data. Position-only holds require only the claim, ID, and clock; they remain unscored without fetching prices.

See [the resolution rules and input contract](docs/resolution.md) before integrating a provider or UI.

Browser smoke tests run against the production build on port 3100:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

If a compatible Chrome or Edge is already installed, set `PLAYWRIGHT_CHANNEL=chrome` or `PLAYWRIGHT_CHANNEL=msedge` instead of downloading Chromium. Browser tests check the replay, workspace screens, unconfigured accounts, and mocked live review/retry behavior. Real Supabase sign-in and email confirmation still need a connected-project check. Screenshots and failure traces are written to the ignored `test-results` directory.

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
| `src/features/ai`          | Parser, evidence, and reasoning-review contracts                                     |
| `src/features/feed`        | Illustrative feed presentation                                                       |
| `src/features/profiles`    | Public profile contract                                                              |
| `src/lib/server`           | Server-only configuration, Supabase clients, and HTTP boundaries                     |
| `supabase`                 | Database migrations and SQL policy/commitment tests                                  |
| `src/demo`                 | Clearly labeled claim examples and fabricated resolution fixtures                    |

Read [the domain rules and module boundaries](docs/architecture.md) before adding services. Part 4 prepares authentication, database protections, and persistent server-side commitment. Keep browser-only replay records out of prospective public statistics.
