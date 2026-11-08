import { expect, test, type Page } from "@playwright/test";
import { defaultTerms } from "../../src/demo/claims";
import { instruments } from "../../src/features/market-data/catalog";
import type { ConfirmedTerms } from "../../src/features/claims/contracts";
import type { ParserResponse } from "../../src/features/ai/parser-contracts";

const baseTerms: ConfirmedTerms = {
  ...defaultTerms,
  instrument: instruments.msft,
  prediction: { kind: "underperform", benchmark: instruments.qqq, metric: "price_return" },
  horizon: { kind: "duration", value: 2, unit: "years" },
  confidencePct: null,
  assumptions: [],
  rationale: "Earnings may slow.",
};
function proposal(originalText: string, terms: ConfirmedTerms | null): ParserResponse {
  const questions = terms
    ? []
    : [
        { field: "benchmark" as const, question: "Which exact benchmark?" },
        { field: "horizon" as const, question: "What explicit calendar horizon?" },
      ];
  return {
    draft: {
      id: "fixture-proposal",
      originalText,
      proposedTerms: terms ?? { instrument: instruments.msft },
      missingFields: questions.map((question) => question.field),
      clarificationQuestions: questions,
    },
    terms,
    ready: !!terms,
    provider: "anthropic",
    model: "fixture-claude-model",
    promptVersion: "fixture-v1",
    warnings: [],
  };
}
async function account(page: Page) {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: { id: "11111111-1111-4111-8111-111111111111", email: "fixture@example.test" },
        profile: null,
      },
    }),
  );
}
test("Claude asks for missing terms, prefills an editable proposal, and never auto-publishes", async ({
  page,
}) => {
  await account(page);
  const parseRequests: { originalText: string; clarifications: unknown[] }[] = [];
  let saves = 0;
  await page.route("**/api/claims", (route) => {
    saves++;
    return route.fulfill({ status: 503, json: { error: "No save expected in this fixture" } });
  });
  await page.route("**/api/claims/parse", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true, provider: "anthropic" } });
    const body = route.request().postDataJSON();
    parseRequests.push(body);
    return route.fulfill({
      json: proposal(body.originalText, body.clarifications.length ? baseTerms : null),
    });
  });
  await page.goto("/new");
  const original = "Microsoft may do worse than the market. Earnings may slow.";
  await page.getByLabel("Original market call", { exact: true }).fill(original);
  await page.getByRole("button", { name: "Make this call testable", exact: true }).click();
  await expect(page.getByText("More detail needed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review live claim" })).toHaveCount(0);
  await page.getByLabel("Which exact benchmark?", { exact: true }).fill("QQQ");
  await page
    .getByLabel("What explicit calendar horizon?", { exact: true })
    .fill("2 calendar years");
  await page.getByRole("button", { name: "Update proposal", exact: true }).click();
  await expect(page.getByText("Proposal ready for your review", { exact: true })).toBeVisible();
  expect(parseRequests[1].originalText).toBe(original);
  expect(parseRequests[1].clarifications).toHaveLength(2);
  expect(saves).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/claude-proposal-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Use proposed terms", exact: true }).click();
  await expect(page.getByLabel("Instrument", { exact: true })).toHaveValue(instruments.msft.id);
  await expect(page.getByLabel("Comparison benchmark", { exact: true })).toHaveValue(
    instruments.qqq.id,
  );
  await expect(page.getByLabel("Duration", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Calendar unit", { exact: true })).toHaveValue("years");
  await page.getByLabel("Duration", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Review live claim", exact: true }).click();
  await expect(page.locator(".live-review-panel")).toContainText(original);
  await expect(page.locator(".live-review-panel")).toContainText("Underperform QQQ");
  await expect(page.locator(".live-review-panel")).toContainText("3 years");
  await expect(page.locator(".live-review-panel")).toContainText("Earnings may slow.");
  expect(saves).toBe(0);
});

test("Claude failure leaves the original available and manual terms usable", async ({ page }) => {
  await account(page);
  await page.route("**/api/claims/parse", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true } })
      : route.fulfill({
          status: 429,
          json: { error: "Fixture capacity limit. Define terms manually." },
        }),
  );
  await page.goto("/new");
  await page.getByLabel("Original market call", { exact: true }).fill("My original AAPL call.");
  await page.getByRole("button", { name: "Make this call testable" }).click();
  await expect(page.locator(".ai-panel [role=alert]")).toContainText("Fixture capacity limit");
  await expect(page.getByLabel("Original market call", { exact: true })).toHaveValue(
    "My original AAPL call.",
  );
  await page.getByRole("button", { name: "Define manually", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review live claim", exact: true })).toBeVisible();
});

test("range proposal retains percent-return units and assumptions through manual editing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await account(page);
  const terms: ConfirmedTerms = {
    ...baseTerms,
    instrument: instruments.aapl,
    prediction: {
      kind: "range",
      lower: -5,
      upper: 5,
      metric: "price_return_pct",
      evaluation: "every_daily_observation",
      boundaries: "inclusive",
    },
    horizon: { kind: "duration", value: 7, unit: "days" },
    assumptions: [
      {
        id: "stated-1",
        statement: "Volatility stays low.",
        falsificationCondition: "Volatility rises.",
      },
    ],
  };
  await page.route("**/api/claims/parse", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true } })
      : route.fulfill({ json: proposal(route.request().postDataJSON().originalText, terms) }),
  );
  await page.goto("/new");
  await page
    .getByLabel("Original market call", { exact: true })
    .fill("AAPL return stays between -5% and 5% at every daily observation for 7 calendar days.");
  await page.getByRole("button", { name: "Make this call testable" }).click();
  await page.getByRole("button", { name: "Use proposed terms", exact: true }).click();
  await expect(page.getByLabel("Range units", { exact: true })).toHaveValue("price_return_pct");
  await page.getByLabel("Upper bound", { exact: true }).fill("6");
  await page
    .getByLabel("What would change this view?", { exact: true })
    .fill("Volatility materially rises.");
  await page.getByRole("button", { name: "Review live claim", exact: true }).click();
  await expect(page.locator(".live-review-panel")).toContainText(
    "-5–6% return at every daily observation",
  );
  await expect(page.locator(".live-review-panel")).toContainText("Volatility materially rises.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/claude-review-mobile.png", fullPage: true });
});

test("editing the original aborts an in-flight proposal and ignores its late response", async ({
  page,
}) => {
  await account(page);
  let release: () => void = () => {};
  let started = false;
  await page.route("**/api/claims/parse", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true } });
    const original = route.request().postDataJSON().originalText;
    started = true;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: proposal(original, baseTerms) }).catch(() => {});
  });
  await page.goto("/new");
  await page.getByLabel("Original market call", { exact: true }).fill("Old original call");
  await page.getByRole("button", { name: "Make this call testable" }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByLabel("Original market call", { exact: true }).fill("A revised original call");
  release();
  await expect(page.getByRole("button", { name: "Make this call testable" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Use proposed terms" })).toHaveCount(0);
  await expect(page.getByLabel("Original market call", { exact: true })).toHaveValue(
    "A revised original call",
  );
});
