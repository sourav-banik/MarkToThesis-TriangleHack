# Part 7: Massive live resolution

The live path keeps the trust boundary explicit:

1. Massive supplies daily bars for the exact stock or ETF symbol.
2. The adapter validates each bar as a `PriceSnapshot` with `isSynthetic: false` and a saved adjustment basis.
3. A separate NYSE calendar supplies weekday and holiday sessions; missing bars are not silently removed from that schedule.
4. `resolveClaim` selects the first eligible start and first observation on or after the target, then calculates the outcome.
5. A trusted Supabase function appends the snapshots and one immutable resolution. Browser users cannot submit scores.

Price performance uses split-adjusted bars and excludes dividends. `total_return` is still rejected by commitment validation. The source URL stored in a snapshot omits the API key.

Apply migrations `202611070001_live_commitment.sql`, `202611070002_instrument_seed.sql`, and `202611070003_massive_resolution.sql` in order. The third migration changes future stock/ETF bindings to Massive; old claim versions retain their original binding and are not rewritten. The resolver currently refuses a claim whose saved binding is not Massive.

Massive does not by itself define the exact fixing for every catalog identity. Treasury yields, WTI spot, gold spot, and crypto therefore remain unavailable to this adapter until a provider-specific schedule and normalization are added. They are not silently mapped to an ETF, futures series, or another instrument.
