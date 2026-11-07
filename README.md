# MarkToThesis

An AI-powered platform for making clear market claims and building a transparent record of their outcomes.

## Current increment: Part 1

This repository contains the Next.js application foundation, shared domain contracts, runtime validation, and an interactive preview workspace. It runs without API keys.

Included:

- Responsive application shell, navigation, reusable UI, and loading/error/empty states.
- Illustrative claim feed, claim-format workbench, instrument browser, example detail pages, and an empty profile shell.
- Contracts for drafts, confirmed terms, committed versions, observations, resolutions, evidence, and reasoning reviews.
- Outperform, underperform, range, and both meanings of hold.
- Broad instrument identities, yield-aware units, flexible horizons, and a reserved dividend-inclusive return convention.

Not connected yet: authentication, database persistence, AI parsing, market-data providers, publishing, or a resolution engine. The preview does not log claims, verify trades, or display real performance. The instrument catalog is illustrative; it is not a guarantee of provider coverage.

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

The contract tests check ambiguous terms, invalid comparisons, yield units, range conditions, flexible horizons, replay timestamps, and evidence references. They do not implement or assert financial resolution calculations; that is Part 2.

Browser smoke tests run against the production build on port 3100:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

If a compatible Chrome or Edge is already installed, set `PLAYWRIGHT_CHANNEL=chrome` or `PLAYWRIGHT_CHANNEL=msedge` instead of downloading Chromium. The browser tests check feed filtering, range validation, hold semantics, custom horizons, mobile navigation, and not-found responses. Screenshots and failure traces are written to the ignored `test-results` directory.

## Modules

| Location                   | Responsibility                                              |
| -------------------------- | ----------------------------------------------------------- |
| `src/app`                  | Thin routes, layouts, global styles, route states           |
| `src/components`           | Shared UI and navigation                                    |
| `src/features/claims`      | Claim contracts, validation, presentation, workbench        |
| `src/features/market-data` | Instrument catalog, observation contracts, adapter boundary |
| `src/features/resolution`  | Calculation input/output contracts; engine comes next       |
| `src/features/ai`          | Parser, evidence, and reasoning-review contracts            |
| `src/features/feed`        | Illustrative feed presentation                              |
| `src/features/profiles`    | Profile contract; account connection comes later            |
| `src/lib/server`           | Server-only configuration and future infrastructure clients |
| `src/demo`                 | Clearly labeled, unsaved examples; no historical prices     |

Read [the domain rules and module boundaries](docs/architecture.md) before adding services. The next increment is the deterministic resolution engine, using these contracts and synthetic test observations before connecting external data.
