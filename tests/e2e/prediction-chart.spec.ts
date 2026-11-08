import { expect, test } from "@playwright/test";
import { standardClaimFields } from "../../src/features/claims/conventions";
import { instruments } from "../../src/features/market-data/catalog";
import type { ConfirmedTerms } from "../../src/features/claims/contracts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const author = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Chart Author",
  handle: "chart_author",
  bio: "",
};
const terms: ConfirmedTerms = {
  ...standardClaimFields,
  assumptions: [],
  instrument: instruments.aapl,
  prediction: { kind: "outperform", benchmark: instruments.spy, metric: "price_return" },
  horizon: { kind: "duration", value: 30, unit: "days" },
  confidencePct: 70,
};
function chartFor(proposed: ConfirmedTerms, committedAt: string | null) {
  const prediction = proposed.prediction;
  return {
    configured: true,
    chart: {
      asset: {
        symbol: proposed.instrument.symbol,
        points: [
          { date: "2026-11-02", value: 100 },
          { date: "2026-11-03", value: 105 },
          { date: "2026-11-06", value: 110 },
        ],
      },
      benchmark:
        prediction.kind === "outperform" || prediction.kind === "underperform"
          ? {
              symbol: prediction.benchmark.symbol,
              points: [
                { date: "2026-11-02", value: 200 },
                { date: "2026-11-03", value: 202 },
                { date: "2026-11-06", value: 210 },
              ],
            }
          : null,
      fromDate: "2026-10-01",
      throughDate: "2026-11-08",
      asOf: "2026-11-08T15:00:00Z",
      committedAt,
      terms: proposed,
      adjustment:
        prediction.kind === "range" && prediction.metric === "quoted_value"
          ? "unadjusted_quoted_price"
          : "split_adjusted_price_return_excluding_dividends",
    },
  };
}
test("a visitor can expand a public prediction chart and inspect observed prices", async ({
  page,
}) => {
  let chartRequests = 0;
  await page.route("**/api/claims?*", (route) =>
    route.fulfill({
      json: {
        configured: true,
        nextCursor: null,
        summary: null,
        claims: [
          {
            version: {
              id,
              claimId: id,
              authorId: author.id,
              version: 1,
              originalText: "AAPL will outperform SPY over 30 days.",
              terms,
              committedAt: "2026-11-02T15:00:00Z",
              publishedAt: "2026-11-02T15:00:00Z",
              visibility: "public",
              context: { kind: "live" },
              supersedesVersionId: null,
            },
            author,
            status: "awaiting_start",
            marketBindings: {},
            supersedesClaimId: null,
          },
        ],
      },
    }),
  );
  await page.route(`**/api/claims/${id}/chart`, (route) => {
    chartRequests++;
    return route.fulfill({ json: chartFor(terms, "2026-11-02T15:00:00Z") });
  });
  await page.goto("/");
  await expect(page.locator(".live-claim-card")).toHaveCount(1);
  expect(chartRequests).toBe(0);
  await page.getByText("View price & prediction chart", { exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Published prediction chart", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("comparison-condition")).toHaveText(
    "AAPL return > SPY return at review",
  );
  await expect(page.getByTestId("logged-marker")).toBeVisible();
  await expect(page.getByTestId("review-marker")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".prediction-chart-scroll")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  const readout = page.locator(".chart-price-readout");
  await expect(readout).toContainText("AAPL: 110 USD");
  await page.getByRole("slider", { name: "Inspect historical prices" }).focus();
  await page.getByRole("slider", { name: "Inspect historical prices" }).press("Home");
  await expect(readout).toContainText("AAPL: 100 USD");
  await page.screenshot({ path: "test-results/public-prediction-chart.png", fullPage: true });
});

test("a draft range updates its visible band before publication and keeps the preview on final review", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: { id: author.id, email: "fixture@example.test" },
        profile: author,
      },
    }),
  );
  await page.route("**/api/market-data/preview", (route) =>
    route.fulfill({ json: chartFor(route.request().postDataJSON().terms, null) }),
  );
  await page.goto("/new");
  await page
    .getByLabel("Original market call", { exact: true })
    .fill("AAPL will finish between 90 and 140 dollars after 30 days.");
  await page.getByRole("button", { name: "Define manually", exact: true }).click();
  await page.getByRole("button", { name: "Range", exact: true }).click();
  await page.getByLabel("Lower bound", { exact: true }).fill("90");
  await page.getByLabel("Upper bound", { exact: true }).fill("140");
  await expect(page.getByTestId("prediction-band")).toContainText("90–140 at review");
  await page.getByLabel("Upper bound", { exact: true }).fill("145");
  await expect(page.getByTestId("prediction-band")).toContainText("90–145 at review");
  await expect(
    page.getByText("Draft overlay uses the latest completed close", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Review live claim", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Draft prediction chart", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("prediction-band")).toContainText("90–145 at review");
  await page.screenshot({ path: "test-results/draft-prediction-chart-mobile.png", fullPage: true });
});
