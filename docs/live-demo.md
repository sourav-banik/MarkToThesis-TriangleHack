# Part 10: simple live demo

The reduced live demo has one path:

1. Create or sign in to an account at `/account`.
2. Open `/new`, write a call, and select **Make this call testable**.
3. Review Claude's proposed terms, edit if needed, and commit the claim.
4. Open `/profile` to see the complete live record and scorecard.
5. Open a stock/ETF claim to inspect its relative Massive price chart and, once eligible, run deterministic resolution.

The live workbench and final confirmation screen now show a price-and-prediction preview. Editing a range, tolerance, or horizon updates its overlay immediately. Historical price data is requested only when the asset, benchmark, or adjustment convention changes, and public market observations are cached for up to one minute. The latest price is a completed daily close, rather than a real-time tick quote.

Public feed cards include **View price & prediction chart**, which loads the chart only when opened. Published claim pages show the same locked prediction with a logging marker, eligible starting session, and review date. Quoted-price ranges use nominal price bands; neutral holds and return ranges use percentage bands; comparison calls show the benchmark and relative-return condition without inventing a future price path. Both comparison lines share one reference session.

Draft overlays use the latest completed close as an illustrative reference. The confirmed claim still starts at the first eligible market close after logging. If that close is pending or missing, the public chart shows historical-price context and explains that the relative-performance baseline is pending. The chart never substitutes a later observation or changes the saved score.

The scorecard counts only saved outcomes: `met` and `not met` make up the met rate. Pending, unclear, and position-only claims remain visible but do not change that rate. The chart uses current split-adjusted daily closes from Massive, excludes dividends, and is explicitly not used to calculate or replace the saved score.

For a fast presentation, log a real claim and show it as prospective, or use the existing clearly labeled synthetic replay for a completed historical walkthrough. Do not present a claim entered today as if it was logged before a historical market move.
