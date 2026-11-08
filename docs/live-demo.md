# Part 10: simple live demo

The reduced live demo has one path:

1. Create or sign in to an account at `/account`.
2. Open `/new`, write a call, and select **Make this call testable**.
3. Review Claude's proposed terms, edit if needed, and commit the claim.
4. Open `/profile` to see the complete live record and scorecard.
5. Open a stock/ETF claim to inspect its relative Massive price chart and, once eligible, run deterministic resolution.

The scorecard counts only saved outcomes: `met` and `not met` make up the met rate. Pending, unclear, and position-only claims remain visible but do not change that rate. The chart uses current split-adjusted daily closes from Massive, excludes dividends, and is explicitly not used to calculate or replace the saved score.

For a fast presentation, log a real claim and show it as prospective, or use the existing clearly labeled synthetic replay for a completed historical walkthrough. Do not present a claim entered today as if it was logged before a historical market move.
