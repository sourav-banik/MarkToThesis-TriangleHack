# MVP acceptance and demo setup

Updated November 8, 2026.

## Scope and flow

The home screen leads with public claims and claim-specific discussion. New claims use Claude clarification, editable terms, optional reasoning and invalidation evidence, a visibility choice, and a final confirmation before saving. Public is selected by default; private remains available. Long statements are supported when they contain one measurable call. Multiple independent calls and future-trigger conditions require clarification rather than silently dropping terms.

Measurable live coverage is deliberately limited to AAPL, MSFT, NVDA, SPY, QQQ, and GLD. Treasury, crypto, FX, and commodity identities remain in the catalog; measurable commitments to those series are blocked until their adapters are implemented. GLD is not substituted automatically for gold spot. Dividend-inclusive performance is still disabled, with the existing total-return extension retained.

The deterministic resolver owns scoring. It uses a price-independent session calendar, Eastern close timestamps with daylight saving and early closes, and a conservative publication cutoff. The reviewed calendar coverage is 2024–2028 and includes the January 9, 2025 exceptional closure. Missing bars remain missing. Literal quoted-value ranges request unadjusted prices; equity performance uses split-adjusted prices. Already saved resolutions remain unchanged.

## Demonstration

1. Sign in and open `/demo`.
2. Enter a vague call. Claude asks for the missing terms.
3. Apply the proposed terms, edit them if needed, and review.
4. Choose a historical date covered by your Massive subscription. A short duration such as 30 calendar days keeps the demo quick.
5. Confirm the labeled historical replay. Massive supplies actual prices, code calculates the result, and Claude can summarize the supplied result with source links. If explanation is unavailable, the numerical result remains visible.
6. Open `/profile` for real logged claims, or `/profile?record=demo` for the separately labeled fictional history containing synthetic wins and misses. Historical replays are excluded from live statistics and public commitments.

The real-price replay currently lasts for the page session and is not saved as a historical prediction. Live commitments use database timestamps and cannot be backdated.

## Public discussion

The public feed refreshes every 30 seconds on its first page. Claim discussion refreshes every 15 seconds and when the browser regains focus. Signed-in readers can comment on public claims; private threads inherit the claim's privacy. URLs in comments are clickable. These are real discussions; the application does not fabricate users, claims, or comments to simulate activity.

## Blockchain history

Apply migrations through `supabase/migrations/202611080006_mvp_integrity.sql`. This adds immutable Base Sepolia receipts, fixes the existing resolution RPC's nonexistent `outcome` column, and disables unsupported live bindings for future commitments.

On a public claim, the owner can anchor the original commitment using a browser wallet with Base Sepolia test ETH. The wallet signs a zero-value transaction to itself with the SHA-256 record hash in calldata. The server checks the RPC chain ID (84532), transaction input, successful receipt, canonical block hash, and block timestamp before saving a receipt. A submitted or pending transaction is not labeled confirmed.

Once resolved, the author can anchor a second record containing the saved resolution and original commitment digest. Original terms and outcomes stay in append-only database tables; the chain stores only the digest. Private claims and replays are excluded from public anchoring. Downloadable proof data includes the canonical JSON, digest, and saved receipts for independent inspection. Canonical JSON recursively sorts object keys by JavaScript string comparison, preserves array order, and uses JSON number/string encoding; the exported canonical string is the exact UTF-8 hashing input.

No blockchain transaction is submitted during automated tests. A wallet confirmation is needed for each real testnet anchor. The receipt proves a record hash existed by its block time; it does not establish a trade, investment amount, first publication elsewhere, or investing skill. Testnet history has no mainnet permanence guarantee.

Official network details: https://docs.base.org/get-started/connect-to-base

## Checks and remaining boundaries

Verification for this increment: 263 unit tests passed, 67 disposable database assertions passed plus the concurrent retry check, and all 23 browser checks passed across the full run and targeted reruns after updating stale expectations. The real Claude API passed five parsing scenarios. The real Massive replay returned 33 observations per series, a deterministic scored outcome, and a Claude explanation with four source references. No live claim or blockchain transaction was created by these checks.

The connected Supabase project was checked read-only: the existing tables are reachable, but `claim_anchors` is not yet present and nine instruments remain enabled. Applying migration 006 is required to activate the new receipt storage and align enabled instruments with the six working Massive bindings.

- `npm run check:mvp` reads configured Supabase tables and checks Base Sepolia connectivity, without saving records.
- `npm run check:claude` sends simple, vague, long-form, multiple-call, and conditional examples to the real model. It uses API credits and saves no claims.
- Unit tests cover parser grounding, numerical rules, calendar behavior, and proof verification. Disposable PostgreSQL tests cover immutable records, RPC persistence, and receipt privileges.
- Manual resolution remains the MVP trigger. Scheduled resolution, larger instrument coverage, confidence calibration, and deeper analytics remain future work.
- Anthropic and Massive availability, subscription coverage, applied SQL migrations, and testnet wallet funding remain deployment prerequisites.

The production build uses Next.js's supported Webpack flag. The bundled Turbopack version failed while generating a source map for a dependency; Webpack compiled the same application successfully.
