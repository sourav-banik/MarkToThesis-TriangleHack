# Part 4: accounts and live commitment

The connection uses server-side Supabase settings. Without them, the app still runs the synthetic replay, displays an honest account setup state, and cannot save live claims. No cloud project, user, email, or live market observation is created by the synthetic demo.

## Connect a project later

1. Create or select a Supabase project. In its SQL editor, run the complete migrations in this order, wrapping each migration in a transaction (`BEGIN;` before it and `COMMIT;` after it):
   - `supabase/migrations/202611070001_live_commitment.sql`
   - `supabase/migrations/202611070002_instrument_seed.sql`
2. Copy `.env.example` to `.env.local`. Set `APP_URL` to the exact browser origin (for example `http://localhost:3000`), `SUPABASE_URL` to the project's URL, and `SUPABASE_PUBLISHABLE_KEY` to its publishable key or legacy anon key. Never use a secret or service-role key. Production accounts also require `APP_URL`; use HTTPS for deployment.
3. In Supabase Auth, enable email/password registration and configure the Site URL and allowed redirect URLs for your app. The signup callback is `/auth/callback?next=...` on `APP_URL`. Allow the callback paths and query strings used by the app for each development/deployment origin. Follow the [Supabase redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls). Keep email confirmation enabled and configure an appropriate email sender before inviting users.
4. Restart Next.js after changing environment variables. Open `/account`, register and confirm the email in the same browser, then sign in. Edit the public display name, handle, and bio. Password recovery and account deletion interfaces are outside this increment.
5. Open `/new`, enter the original wording, manually define the terms, review them, and confirm. The database returns the logged timestamp. Private is the default; choose public before confirmation to put a call on the feed and `/u/[handle]`.

Use the same hostname in the browser and `APP_URL`; `localhost` and `127.0.0.1` are different origins. `APP_URL` controls mutation-origin checks, redirects, and secure cookies. All environment variables stay on the server; none needs a `NEXT_PUBLIC_` prefix. AI and market-provider credentials are unnecessary for manual commitment. Part 6 uses `ANTHROPIC_API_KEY` for optional [Claude clarification](claude-parser.md).

These migrations target a project where the application tables do not already exist. They are not a reset script. Do not run `supabase/tests/bootstrap.sql` against a real project: it supplies a test-only Auth fixture. The repository does not yet include a linked Supabase CLI project.

## Modules and request boundaries

Part 5 extends the read side with filtered feeds and full-history summaries; see [feed and record behavior](feed-and-records.md). It uses these same migrations, without schema changes.

| Module                                      | Responsibility                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/features/auth`                         | Validated account DTOs, email/password flows, fresh Auth verification, and account UI |
| `src/lib/server/supabase.ts`                | Per-request SSR client and separate anonymous public-read client                      |
| `src/proxy.ts`                              | Session refresh and cookie/cache-header propagation                                   |
| `src/features/claims/live-contracts.ts`     | Strict live input and persisted-record schemas                                        |
| `src/features/claims/server.ts`             | Atomic commitment RPC, database mapping, and cursor pagination                        |
| `src/features/market-data/live-bindings.ts` | Canonical instrument identity and fixed provider-series bindings                      |
| `supabase/migrations`                       | Ownership, privacy, append-only records, and transaction enforcement                  |

The thin API routes are:

| Route                       | Behavior                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/account`          | Connection state and verified user's safe account fields                      |
| `PATCH /api/account`        | Update only the verified user's public profile fields                         |
| `POST /api/auth/sign-up`    | Register with email confirmation callback                                     |
| `POST /api/auth/sign-in`    | Sign in using email and password                                              |
| `POST /api/auth/sign-out`   | Sign out of the current session                                               |
| `GET /auth/callback`        | Exchange a PKCE confirmation code and redirect to an allowed app path         |
| `POST /api/claims`          | Validate terms, require authentication, and call `commit_claim`               |
| `GET /api/claims`           | Public claims, or verified owner's claims with `scope=mine`                   |
| `GET /api/claims/[id]`      | Public claim or verified owner's private claim; hidden/absent both return 404 |
| `GET /api/authors/[handle]` | Public profile and only its public claims                                     |

Mutations require the configured app origin. JSON input is bounded to 64 KiB. Owner, timestamp, context, prices, and outcome cannot be supplied as claim-creation fields. Responses containing account or claim data disable caching; public feed/author queries use a separate anonymous client even when the browser belongs to an owner. Signed-in private reads verify the user against Auth, rather than trusting a decoded session's user field. The SSR implementation follows [Supabase's server-side client guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

## Database guarantees

`commit_claim` is an authenticated, security-definer function with a fixed empty search path. It derives ownership from `auth.uid()`, validates the complete terms against the database instrument catalog, and atomically inserts a claim and its first version with one database clock value. It forces live context. PostgreSQL validation also protects callers that invoke the RPC directly instead of using Next.js.

An owner-scoped idempotency key and canonical request hash prevent duplicate commitments. Concurrent identical retries return the same claim and original timestamp. Reusing the key for different terms fails. The browser retains the same request body/key for retries while the review is open; it does not claim this retry state survives closing or refreshing the page.

Authenticated clients have no direct insert/update/delete permission on claims, versions, snapshots, or resolutions. Append-only triggers also reject ordinary privileged updates/deletes. RLS exposes a private claim and its versions/price inputs/resolutions only to its owner. Public profiles contain display name, handle, and bio, never a copied Auth email. See the [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

Visibility is fixed at commitment. There is no publish-later, hide, edit, or delete operation for committed claims. A changed forecast must be a new linked claim; the RPC supports an optional owned predecessor and retains both originals. A public successor cannot disclose a private predecessor ID. A dedicated amendment UI is deferred.

Snapshot and resolution tables are protected storage boundaries for a future trusted resolver; clients cannot insert a score. No live data fetching, starting-price capture, or scheduled resolution runs in Part 4. A measurable claim therefore starts as `awaiting_start`; a position-only hold is `unscored`. The saved timestamp proves only when the call was logged on ProvenAlpha, not a trade or earlier publication.

## Instrument and scoring coverage

Live measurable commitment requires an exact identity and frozen provider binding. The initial seed enables AAPL, MSFT, NVDA, SPY, QQQ, and GLD using explicit Twelve Data listings, FRED DGS5/DGS10 Treasury yields, and FRED DCOILWTICO WTI spot. These are planned adapter bindings, not a claim that API coverage, display licenses, or data retrieval has already been verified.

Gold spot, Bitcoin, Ethereum, and EUR/USD price forecasts remain replay-only until their provider and daily fixing are pinned down. Their position-only holds can be logged live without prices and remain unscored. GLD is a distinct ETF, not a replacement for gold spot. Add supported instruments by extending the canonical catalog and binding definitions, then generate the instrument seed with `npm run db:seed:generate`. After initial deployment, use a new migration for catalog changes instead of rewriting applied history.

The existing prediction types, flexible horizons, dividend exclusion, and reserved future total-return convention are preserved. Yield changes stay in basis points. Binding a provider does not implement its schedule, split-adjustment basis, or resolver integration; those remain separate work. Replay records and fabricated outcomes never enter the live tables or feed.

## Validation

`npm run check` covers request validation, verified authentication, origin checks, cache behavior, public/private query boundaries, RPC arguments, exact database timestamp preservation, and safe failures, alongside the existing domain/resolver/replay tests.

`npm run test:database` uses installed PostgreSQL binaries to create a new disposable cluster under `.local-db-tests`, apply the actual migrations, and test grants, RLS, append-only protection, atomic rollback, direct-RPC rejection, server timestamps, and concurrent idempotent retries. It does not connect to or reset an existing database. Set `PG_BIN` to your PostgreSQL binary directory if needed; the Windows default is `C:/Program Files/PostgreSQL/18/bin`. The runner stops its cluster and retains ignored logs/data for inspection. Its small `auth.uid()` fixture tests database policies, not the real Supabase Auth service.

Browser tests cover the unconfigured account state and, using clearly mocked account/API responses, live review, blocked source bindings, and identical-body retry behavior. Real email delivery, Supabase Auth, PKCE confirmation, and hosted PostgREST integration still require a connected project's end-to-end check. They are not represented as tested cloud behavior.
