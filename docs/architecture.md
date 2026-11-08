# Application architecture: Parts 1–4

## Boundaries

This is one modular Next.js application. Route files render feature components; they do not contain provider integrations or financial calculations. Contracts use Zod as the runtime source of truth, with TypeScript types inferred from those schemas.

- Claims own original wording, drafts, confirmed terms, and committed versions.
- Market data owns precise instrument identities and normalized observations.
- Resolution consumes committed terms, independent schedules, and observations. The pure Part 2 engine determines outcomes; AI must not determine them. See [resolution rules](resolution.md).
- AI proposes a draft or reviews supplied evidence. Its explanation is separate from a numerical resolution.
- Feed and profiles display records. Public database-backed calls are separate from format examples and synthetic replay history. Public feed/profile queries always use an anonymous database client.
- Replay owns the synthetic UI dataset and tab-local state. Its result component consumes the existing resolver output rather than calculating returns or hard-coding wins. See [replay integration](replay.md).
- Provider clients and secrets belong behind `src/lib/server` or server-only feature services. Client components may import pure contracts and presentation helpers.

Part 4 adds verified account services, per-request Supabase clients, and database migrations. Their connection is prepared for later; missing configuration produces an explicit setup state rather than simulated sign-in or publishing. See [accounts and live commitment](persistence.md).

## Claim kinds

| Kind                     | Testable meaning                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outperform               | Strictly greater price return than the benchmark; for two yield series, strictly greater yield change in basis points, explicitly labeled as yield change rather than investment performance. |
| Underperform             | Strictly smaller price return or explicitly specified yield change than the benchmark.                                                                                                        |
| Hold / neutral           | Change stays within a specified positive tolerance of its starting observation, checked either at review or at every daily observation.                                                       |
| Hold / maintain position | Author's position stance; unscored. It neither verifies a position nor creates a win/miss.                                                                                                    |
| Range                    | Inclusive lower and upper bounds, checked at review or every daily observation. Metric is quoted value, price return percent, or yield change in basis points.                                |

No default benchmark, tolerance, range, or confidence should be invented by a future parser. Incomplete drafts are separate from confirmed terms. The workbench is a format sandbox with editable example defaults, not an AI interpretation of user text.

Comparison metrics must match observation types. Yield changes cannot be compared against equity price returns. Cross-currency price comparisons are rejected until an explicit FX method exists. Strict comparison ties will be not met. Range bounds are inclusive. Daily sampling does not establish that a condition held intraday.

## Instrument identity and coverage

The starter catalog demonstrates stocks, ETFs, Treasury yield, gold spot, WTI spot, Bitcoin, Ethereum, and EUR/USD. The schema is not tied to that catalog: additional stocks, indices, commodities, or other supported asset classes can be represented with an explicit identity.

An identity includes stable internal ID, symbol, name, asset class, venue, exact series definition, quote units, observation calendar, fixing description, and IANA time zone. Source and provider series ID are retained on observations. Before a live commitment is enabled, its service must bind the instrument to an available provider series and an exact fixing. Several catalog entries explicitly leave that binding pending. Do not substitute GLD for spot gold or an oil futures series for WTI spot.

The U.S. 5-year Treasury example represents [FRED DGS5 / Federal Reserve H.15](https://fred.stlouisfed.org/series/DGS5): a constant-maturity yield quoted in percent. A move from 4% to 4.25% is +25 basis points, not a 6.25% investment return. Treasury publication time may differ from its observation date.

Calendar types distinguish exchange sessions, UTC daily crypto observations, and publisher daily series. A future adapter must supply the actual regular-session or fixing schedule. Publication delays, weekends, and holidays cannot be handled by pretending every instrument has a U.S. equity close.

WTI explicitly permits signed observations. The resolver must reject an undefined or economically unsuitable percentage-return denominator (for example a zero or negative starting price) with a documented unclear result instead of blindly dividing. Valid quote-level ranges can still be evaluated.

## Horizons and windows

Durations accept positive whole days, months, or years, including one-day and multi-year horizons. Alternatively the author may choose a target date. A month is a calendar month, not 30 days. The engine clamps end-of-month overflow to the last valid date, with leap-year and multi-year tests.

The first eligible daily observation strictly after commitment supplies the starting value. A duration is measured from that starting session's date. The ending observation is the first eligible observation on or after the target date. The engine aligns comparison endpoints on common session dates, retaining each source's explicit fixing times. It validates actual observation availability and never picks a later price to replace a missing scheduled observation. These are dated-fixing comparisons, not synchronized execution returns.

For a date horizon, commitment validation requires a date after the relevant commitment date. The engine additionally requires a valid, nonzero window after selecting the actual starting observation. Date calculations use saved calendar rules and fixing timestamps. Missing data results in awaiting data, not a substitute fixing or a premature miss.

Very long horizons that exceed the implementation's supported date representation must fail explicitly in window construction. Do not quietly clamp requested durations or change them.

## Return conventions

Price performance initially excludes dividends and adjusts for splits. Store the convention with every version. Yield levels and changes do not apply the price-return convention.

Literal quoted-value ranges use unadjusted nominal prices. An equity price target is not silently rebased after a split. Percentage-return tests use split-adjusted equity/ETF observations; non-equity price series use unadjusted observations. This distinction is saved in the resolution inputs and formula version.

The contract separately represents a future total-return convention with reinvested dividends and an explicit methodology ID. It is rejected by current commitment validation; adding the type is not enabling dividend-inclusive scoring. Implement and verify its data requirements and calculator before permitting it.

Save adjustment mode and an adjustment-basis ID on observations. A starting historical adjusted price saved before a later split may be incompatible with an end price downloaded afterward. The resolver must use a consistent basis for both endpoints, preserve exact inputs, and never use rounded display returns to decide an outcome. Spot instruments and ETFs retain their separate identities.

## Lifecycle and trust

The shared lifecycle is awaiting start, active, awaiting data, met, not met, unclear, or unscored. Drafts are not committed records. A withdraw/annotation event in a later increment must not erase the original terms or reset the original measurement window.

Committed versions preserve original text, confirmed terms, author, actual server logging timestamp, publication timestamp, visibility, and context. Live and replay contexts are distinct. A replay has a separate simulated historical commitment timestamp and dataset ID; it must not backdate the actual logging timestamp.

Server services and database policies enforce atomic creation, ownership, idempotency, and append-only records. A TypeScript readonly type or schema validation alone does not enforce database immutability. Changed forecast terms must create a new linked claim without replacing the original scored call; version links retain provenance. Visibility is fixed at commitment. The RPC supports owned predecessor links; a dedicated amendment UI is deferred.

Prospective public statistics must exclude replays, private claims, late-publicized calls, and position-only holds. Public visibility and withdrawal rules must prevent selectively hiding misses. Profiles will need explicit sample sizes and pending/unclear counts. None of these statistics are fabricated in the current UI.

Part 3 adds a separate fictional-author history containing synthetic outcomes. These are explicitly labeled and do not enter a live record. Browser-confirmed copies use the domain version structure with `visibility: private`, `publishedAt: null`, and a replay context. Their timestamp is browser-supplied and clearly presented as such. Part 4 live commitments use the database clock and force live context; no replay conversion endpoint exists. The `sessionStorage` copy is editable by its browser owner and must never be imported as a verified public commitment.

## Evidence and AI

Evidence retains URL, publisher, publication and retrieval timestamps, saved excerpt, and who supplied it. Each reasoning assessment references evidence IDs supplied with that review. Supported/contradicted assessments require evidence; unresolved is a valid result. The future review service must also verify assumption IDs against the committed version and enforce evidence cutoffs for replay scenarios.

AI reviews are not causal proof of a price movement. There is no market-performance outcome field in their contract. Only the deterministic resolver may produce the saved resolution.

## Next increment

Part 4 prepares authentication, database protections, atomic server-side commitment, and basic live record views. Next, connect and verify the actual Supabase project, then deepen live feed/profile behavior within the agreed modular build sequence. AI parsing and market-provider/resolution integration remain separate increments. Synthetic replay records stay separate from real claims.

## Dependency maintenance

The targeted `@typescript-eslint/typescript-estree` minimatch override keeps the lint toolchain on the patched 11.x glob parser instead of the vulnerable transitive 10.x version. Recheck and remove this override when the upstream dependency accepts a patched release. It does not affect the production application's claim logic.
