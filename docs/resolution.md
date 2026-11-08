# Deterministic resolution engine

## Entry point and scope

`resolveClaim(input)` in `src/features/resolution/resolve.ts` is a pure function. It does not fetch data, call a model, access the database, create timestamps, or generate IDs. The caller supplies a stable resolution ID and explicit `asOf` instant. Equal inputs produce equal results; inputs are not mutated.

The current formula version is `daily-claims-v1`. Formula changes that affect measurement or outcomes need a new version. Persistence, authorization, provider integrations, corrections to stored records, and the replay UI remain separate increments.

## Input boundary

A scorable request contains:

- `resolutionId`: stable caller-provided ID, later used by persistence for idempotency.
- `claim`: a validated committed version, including exact instrument, terms, actual logging time, and live/replay context.
- `asOf`: actual calculation/data cutoff, never earlier than actual logging time.
- `asset`: an independently supplied observation schedule and its snapshots.
- `benchmark`: the same for the committed benchmark, or null for a non-comparison.

A position-only hold accepts just the ID, claim, and clock. It returns unscored without requiring a calendar or prices. Confidence and rationale never affect the numerical score.

Schemas validate unknown input at runtime. Malformed requests return `invalid_input` with field issues. Invalid market records, inconsistent identities/sources, conflicting corrections, unsupported calculations, or incompatible adjustments return `unclear` with a reason. No such condition becomes a fabricated loss.

## Schedules, not available-price selection

Each schedule binds an exact instrument to a provider, series ID, synthetic/market-data classification, calendar ID/version, coverage dates, and explicit fixing/publication timestamps for every eligible session. Its `complete_for_coverage` declaration is a guarantee the future calendar adapter must substantiate. UTC daily schedules must enumerate every covered date. Exchange and publisher holidays must come from their respective calendar adapters; the engine does not guess them from weekdays or missing prices.

Coverage must reach back to commitment to establish the earliest eligible start. Do not construct a schedule by filtering the prices that were successfully downloaded. An omitted price remains a missing observation; it does not become a holiday.

For comparisons, select the earliest common session date for which both fixing instants are strictly after commitment. Select the first common session date on or after the horizon's target as the end. Both endpoints therefore use the same dated sessions. The two fixings may occur at different instants, retained explicitly in the inputs. These comparisons do not imply synchronized or executable trades. If either ending fixing has not happened, the claim remains active.

For single-asset claims, use that instrument's own scheduled sessions. A crypto every-day range includes weekend observations. A stock/crypto comparison uses their common dates. Daily range/hold evaluation includes the start, every scheduled intermediate fixing, and the end; endpoint evaluation tests only the end. Daily sampling says nothing about intraday excursions.

The first scheduled start and end are fixed even if their prices are unavailable. Missing endpoints, incomplete calendars, and missing required intermediate observations remain pending. Published or retrieved data after `asOf` is not eligible. Later prices, forward fills, averages, and provider substitutions are never fallback inputs.

## Horizon arithmetic

Days are calendar days from the starting session date, not a count of market bars. Months and years use Gregorian calendar arithmetic and clamp to month end. January 31 plus one month becomes February 28 or 29; February 29 plus one year becomes February 28. Weekend/holiday targets advance only through the independently supplied schedule. UTC date arithmetic avoids inheriting the host timezone or a fixed 24-hour daylight-saving assumption.

A specific target must follow the actual selected starting date. A date that was valid at commitment can become invalid if the first available scheduled start is delayed until that date. The engine marks that window unclear instead of creating a zero-length return. Unrepresentable multi-year horizons fail explicitly; they are not silently shortened.

## Calculations and outcomes

| Prediction    | Metric and rule                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outperform    | Asset return minus benchmark return strictly greater than zero. For yield comparisons, asset yield change minus benchmark yield change strictly greater than zero. |
| Underperform  | The same relative measure strictly less than zero.                                                                                                                 |
| Neutral hold  | Change lies inclusively between negative and positive stated tolerance.                                                                                            |
| Position hold | Unscored, with no win, miss, or calculated performance.                                                                                                            |
| Range         | The specified metric lies inclusively between the saved lower and upper bounds.                                                                                    |

Price return percent is `(end - start) / start * 100`. Excess return is the difference between returns in percentage points, not a compounded relative wealth ratio. Yield observations are already percent levels; change in basis points is `(end - start) * 100`. Neither the yield level nor its change is a bond investment return. Negative yield levels are allowed.

Quoted-value ranges test the native observed quote (for example dollars per barrel or percent yield). Percentage-return bands and bps-change bands test changes from the selected start. A zero or negative price denominator cannot produce a percentage return, but an absolute quoted-value range can still be evaluated for a signed commodity series. Non-finite or unrepresentable numeric outputs are unclear.

Score comparisons use exact rational arithmetic over the decimal representations of the saved numeric inputs. No rounded display percentage or epsilon decides ties or band boundaries. Outputs are converted to finite JavaScript numbers for storage/display after exact comparisons. This preserves the precision present in the existing numeric input contract; it cannot recover decimal digits a provider discarded before creating a number.

## Adjustments and data integrity

Equity/ETF percentage returns require split-adjusted prices, with the same adjustment basis at both endpoints and every tested intermediate observation. Other priced assets use unadjusted quotes. Yield snapshots use `not_applicable`. Dividend-inclusive series are rejected until the reserved total-return method is implemented.

Literal quoted-value ranges require unadjusted nominal prices, including equities. This avoids silently moving a saved dollar range when historical prices are rebased after a split. Such a range describes quoted price levels, not shareholder wealth. A future alternative to adjust target bounds must be explicit in the committed terms and formula version.

Each observation must match the scheduled full instrument identity, provider, series ID, data classification, session date, and exact fixing instant. Conflicting values or adjustment bases for one session produce unclear; the resolver never picks a favorable correction. Economically identical duplicates select a stable copy regardless of input order. Snapshot IDs cannot identify different session dates.

## Outputs and audit trail

- `awaiting_start`: the chosen starting fixing has not occurred, or no eligible start is yet covered.
- `active`: the horizon or selected review fixing is still in the future.
- `awaiting_data`: missing observations, delayed publications/retrieval, or insufficient calendar coverage. Includes missing session details when known.
- `met` / `not_met`: validated, reproducible numerical result with the exact snapshots, calendar definitions, measurement window, convention/formula version, calculated metrics, and individual band checks.
- `unclear`: documented integrity, rule, or numeric issue; no performance score is fabricated.
- `unscored`: a position statement without a measurable outcome.
- `invalid_input`: request validation errors; no resolution record is invented.

Actual logging time, calculation time, replay context, and synthetic provenance remain distinct in the output. Pending attempts are not final resolution records. The engine itself cannot guarantee database idempotency, immutability, trustworthy source calendars, or privacy; the later persistence and provider services must enforce those boundaries.

## Verification and next integration

`npm run test:resolution` checks the engine without API keys or network calls. The reusable fixture in `src/demo/resolution.ts` uses entirely fabricated schedules and numbers, despite having historical date labels. Its one-day comparison returns +10% asset, +5% benchmark, +5 percentage points excess, met.

Part 3 now passes a versioned `synthetic-ui-v1` request to this same entry point and renders saved observations, comparison metrics, daily checks, and the calculation trail. Its three-day UI example differs from the original one-day engine fixture while using the same resolver. Public publishing remains disabled. A later market-data adapter can replace fixture schedules and snapshots without moving financial logic into the UI or AI layer. See [replay integration](replay.md).
