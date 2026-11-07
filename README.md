# MarkToThesis

An AI-powered platform for making clear market claims and building a transparent record of their outcomes.

## Current increment: Part 2

This repository contains the Next.js application foundation, shared domain contracts, an interactive preview workspace, and a deterministic resolution engine. It runs without API keys.

Included:

- Responsive application shell, navigation, reusable UI, and loading/error/empty states.
- Illustrative claim feed, claim-format workbench, instrument browser, example detail pages, and an empty profile shell.
- Contracts for drafts, confirmed terms, committed versions, observations, resolutions, evidence, and reasoning reviews.
- Outperform, underperform, range, and both meanings of hold.
- Broad instrument identities, yield-aware units, flexible horizons, and a reserved dividend-inclusive return convention.
- Calendar-based measurement-window selection, exact decimal scoring, reproducible calculation inputs, and explicit pending/unclear states.
- Synthetic resolution fixtures and tests for comparisons, neutral holds, unscored position statements, and endpoint/daily ranges.

Not connected yet: authentication, database persistence, AI parsing, market-data providers, or publishing. The engine is a pure module; connecting its results to the replay UI is Part 3. The preview does not log claims, verify trades, or display real performance. The instrument catalog is illustrative; it is not a guarantee of provider coverage.

## Local setup

Use Node.js 24 LTS and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Optionally copy `.env.example` to `.env.local` when configuring future integrations. Keep provider secrets on the server; never add a `NEXT_PUBLIC_` prefix to secrets. Empty credentials are valid in this increment.

## Checks

```sh
npm run check
npm run build
```

The tests cover contract validation and deterministic financial calculations, including ties, inclusive bounds, daily breaches, calendar alignment, month ends, leap years, missing prices, publication delays, split bases, replay timestamps, and evidence references. Run just the engine checks with `npm run test:resolution`.

The engine entry point is `resolveClaim` in `src/features/resolution/resolve.ts`. Supply a committed claim version, a stable resolution ID, an explicit `asOf` timestamp, independently supplied observation schedules, and price/yield snapshots. `syntheticResolutionRequest()` in `src/demo/resolution.ts` supplies a fabricated replay request: asset +10%, benchmark +5%, excess +5 percentage points, outcome met. It is not real historical market data. Position-only holds require only the claim, ID, and clock; they remain unscored without fetching prices.

See [the resolution rules and input contract](docs/resolution.md) before integrating a provider or UI.

Browser smoke tests run against the production build on port 3100:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

If a compatible Chrome or Edge is already installed, set `PLAYWRIGHT_CHANNEL=chrome` or `PLAYWRIGHT_CHANNEL=msedge` instead of downloading Chromium. The browser tests check feed filtering, range validation, hold semantics, custom horizons, mobile navigation, and not-found responses. Screenshots and failure traces are written to the ignored `test-results` directory.

## Modules

| Location                   | Responsibility                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `src/app`                  | Thin routes, layouts, global styles, route states                                   |
| `src/components`           | Shared UI and navigation                                                            |
| `src/features/claims`      | Claim contracts, validation, presentation, workbench                                |
| `src/features/market-data` | Instrument catalog, observation contracts, adapter boundary                         |
| `src/features/resolution`  | Calendar selection, exact arithmetic, data validation, and deterministic resolution |
| `src/features/ai`          | Parser, evidence, and reasoning-review contracts                                    |
| `src/features/feed`        | Illustrative feed presentation                                                      |
| `src/features/profiles`    | Profile contract; account connection comes later                                    |
| `src/lib/server`           | Server-only configuration and future infrastructure clients                         |
| `src/demo`                 | Clearly labeled claim examples and fabricated resolution fixtures                   |

Read [the domain rules and module boundaries](docs/architecture.md) before adding services. The next increment connects the complete replay interface to the engine using clearly labeled fixtures, before persistence and external providers.
