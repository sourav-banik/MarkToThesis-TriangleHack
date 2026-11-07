import { expect, test } from "@playwright/test";

test("illustrative feed filters, search, and detail links work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Conviction deserves");
  await expect(
    page.getByText("These examples are not published calls", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".claim-card")).toHaveCount(6);
  await page.screenshot({ path: "test-results/home-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Underperform", exact: true }).click();
  await expect(page.locator(".claim-card")).toHaveCount(1);
  await expect(page.locator(".claim-card")).toContainText("NVIDIA");
  await page.getByRole("button", { name: "All claims", exact: true }).click();
  await page.getByRole("textbox", { name: "Search claim examples" }).fill("Treasury");
  await expect(page.locator(".claim-card")).toHaveCount(1);
  await page
    .getByRole("link", {
      name: "The 5-year Treasury yield will be between 3.5% and 4.5% in two years.",
    })
    .click();
  await expect(
    page.getByText("Yield levels in percent; changes in basis points.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("None. This is an unsaved format example.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("range validation and both hold meanings are inspectable", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "Range", exact: true }).click();
  await page
    .getByLabel("Instrument", { exact: true })
    .selectOption("us:treasury:constant-maturity:5y");
  await page.getByLabel("Lower bound", { exact: true }).fill("4.5");
  await page.getByLabel("Upper bound", { exact: true }).fill("3.5");
  await page.getByRole("button", { name: "Check the format" }).click();
  await expect(page.getByRole("status")).toContainText(
    "The upper bound must exceed the lower bound.",
  );
  await page.getByLabel("Upper bound", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Check the format" }).click();
  await expect(page.getByRole("status")).toContainText("The format is valid");
  await expect(page.locator(".workbench-preview .claim-condition")).toContainText("4.5–5% yield");
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  await expect(page.getByLabel("Tolerance from starting value (basis points)")).toBeVisible();
  await page.getByLabel("What does “hold” mean?").selectOption("maintain_position");
  await expect(page.locator(".workbench-preview .claim-condition")).toContainText(
    "no performance score",
  );
  await page.getByLabel("Duration", { exact: true }).fill("5");
  await page.getByLabel("Calendar unit", { exact: true }).selectOption("years");
  await expect(page.locator(".workbench-preview .claim-metadata")).toContainText("5 years");
  await page.getByLabel("Review horizon", { exact: true }).selectOption("date");
  await page.getByLabel("Target date", { exact: true }).fill("2031-05-31");
  await expect(page.locator(".workbench-preview .claim-metadata")).toContainText("May 31, 2031");
  await page.screenshot({ path: "test-results/workbench-desktop.png", fullPage: true });
});

test("market search, mobile navigation, and the empty profile remain honest", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/markets");
  await page.getByRole("textbox", { name: "Search instruments" }).fill("Bitcoin");
  await expect(page.locator(".market-card")).toHaveCount(1);
  await expect(page.locator(".market-card")).toContainText("Provider connection pending");
  await page.getByRole("link", { name: "Your record", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A clean slate, not an invented track record" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Claim feed", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Conviction deserves");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/home-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "New claim", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("unknown claim IDs return a real not-found response", async ({ page }) => {
  const response = await page.goto("/claims/missing-example");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "That claim isn’t here" })).toBeVisible();
});
