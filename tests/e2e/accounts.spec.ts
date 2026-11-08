import { expect, test } from "@playwright/test";

test("unconfigured accounts do not offer a fake sign-in or create server claims", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Accounts are not connected in this preview" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveCount(0);
  await page.goto("/new");
  await expect(
    page.getByText("Live accounts are not connected in this preview.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm & save live claim", exact: true }),
  ).toHaveCount(0);
  const crossSite = await page.request.post("/api/claims", {
    headers: { Origin: "https://evil.example" },
    data: {},
  });
  expect(crossSite.status()).toBe(403);
  const unconfigured = await page.request.post("/api/claims", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {},
  });
  expect(unconfigured.status()).toBe(503);
  const publicFeed = await page.request.get("/api/claims");
  expect(await publicFeed.json()).toEqual({
    configured: false,
    claims: [],
    nextCursor: null,
    summary: null,
  });
  expect(publicFeed.headers()["cache-control"]).toContain("no-store");
});

test("live review and retry preserve one submission key without inventing a saved result", async ({
  page,
}) => {
  // UI-only account fixture: SQL policy tests verify real persistence separately.
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: { id: "11111111-1111-4111-8111-111111111111", email: "fixture@example.test" },
        profile: {
          id: "11111111-1111-4111-8111-111111111111",
          handle: "fixture_owner",
          displayName: "Fixture Owner",
          bio: "",
        },
      },
    }),
  );
  const requests: string[] = [];
  await page.route("**/api/claims", (route) => {
    requests.push(route.request().postData() ?? "");
    return route.fulfill({
      status: 503,
      json: { error: "Test outage: retry the same submission safely." },
    });
  });
  await page.goto("/new");
  await page.getByRole("button", { name: "Define manually", exact: true }).click();
  await page
    .getByLabel("Original market call", { exact: true })
    .fill("AAPL will outperform SPY in the next month.");
  await page
    .getByLabel("Reasoning · optional", { exact: true })
    .fill("The stated earnings assumption is resilient.");
  await page.getByRole("button", { name: "Review live claim", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm the exact test." })).toBeVisible();
  await expect(
    page.getByText("The database issues it when saving", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm & save live claim", exact: true }).click();
  await expect(page.locator('.form-message[role="alert"]')).toContainText("Test outage");
  await page.getByRole("button", { name: "Confirm & save live claim", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toBe(requests[0]);
  const payload = JSON.parse(requests[0]);
  expect(payload.visibility).toBe("public");
  expect(payload).not.toHaveProperty("committedAt");
  expect(payload).not.toHaveProperty("authorId");
  expect(payload).not.toHaveProperty("context");
  await expect(page.locator(".live-review-panel")).toBeVisible();
  await expect(page.getByText("Server logging time", { exact: true })).toHaveCount(0);
});

test("live requests reject unresolved price references while an unscored stance remains available", async ({
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
  await page.goto("/new");
  await page.getByRole("button", { name: "Define manually", exact: true }).click();
  await page.getByLabel("Original market call", { exact: true }).fill("My view of Bitcoin.");
  await page.getByLabel("Instrument", { exact: true }).selectOption("crypto:btc:usd");
  await page.getByRole("button", { name: "Review live claim", exact: true }).click();
  await expect(page.locator('.form-message[role="alert"]')).toContainText(
    "needs a fixed live data source",
  );
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  await page
    .getByLabel("What does “hold” mean?", { exact: true })
    .selectOption("maintain_position");
  await page.getByRole("button", { name: "Review live claim", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm the exact test." })).toBeVisible();
  await expect(page.locator(".live-review-panel")).toContainText("no performance score");
});
