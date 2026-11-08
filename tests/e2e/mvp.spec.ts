import { expect, test } from "@playwright/test";
import { comparisonExtraction, completeCall } from "../../src/features/ai/test-fixtures";
import { normalizeExtraction } from "../../src/features/ai/normalize";
import { parserRequestSchema } from "../../src/features/ai/parser-contracts";

test("market replay requires review and stays visibly separate from public history", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: { id: "11111111-1111-4111-8111-111111111111", email: "fixture@example.test" },
        profile: null,
      },
    }),
  );
  await page.route("**/api/claims/parse", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true } });
    const input = parserRequestSchema.parse(route.request().postDataJSON());
    return route.fulfill({
      json: normalizeExtraction(comparisonExtraction(), input, {
        id: "fixture",
        model: "fixture-claude",
        now: "2026-11-08T15:00:00Z",
      }),
    });
  });
  let runs = 0;
  await page.route("**/api/replay/market", (route) => {
    runs++;
    return route.fulfill({
      json: {
        replay: true,
        recordedAt: "2026-11-08T15:00:00Z",
        explanation: null,
        attempt: {
          status: "active",
          reasonCode: "horizon_not_elapsed",
          reason: "The review horizon has not elapsed.",
          window: null,
          missingObservations: [],
        },
      },
    });
  });
  await page.goto("/demo");
  await page.getByLabel("Original call", { exact: true }).fill(completeCall);
  await page.getByRole("button", { name: "Make this call testable", exact: true }).click();
  await page.getByRole("button", { name: "Use proposed terms", exact: true }).click();
  expect(runs).toBe(0);
  await page.getByRole("button", { name: "Review replay terms", exact: true }).click();
  await expect(page.getByRole("heading", { name: "3. Confirm this replay" })).toBeVisible();
  expect(runs).toBe(0);
  await page
    .getByRole("button", { name: "Confirm and resolve historical replay", exact: true })
    .click();
  await expect(page.getByText("Actual replay entry time:", { exact: false })).toBeVisible();
  await expect(
    page.getByText("It is excluded from public claims, live statistics, and blockchain history.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(runs).toBe(1);
});

test("signed-out visitors can reach the live feed and historical demo entry", async ({ page }) => {
  await page.route("**/api/claims?*", (route) =>
    route.fulfill({ json: { configured: true, claims: [], nextCursor: null, summary: null } }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Public calls and discussion" })).toBeVisible();
  await page
    .getByRole("link", { name: "Run the complete AI + historical market-data demo" })
    .click();
  await expect(
    page.getByRole("link", { name: "Sign in to run a replay with Massive prices and Claude." }),
  ).toBeVisible();
});
