import { expect, test, type Page } from "@playwright/test";

async function lockReplay(page: Page) {
  await page.getByRole("button", { name: "Review replay terms", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The exact call you’re locking." })).toBeVisible();
  await page.getByRole("button", { name: "Confirm & lock replay", exact: true }).click();
  await expect(page).toHaveURL(/\/replay\/replay-[a-z0-9-]+$/);
}

test("complete replay preserves terms, results, history, reloads, and legacy tab data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("link", { name: "Start replay", exact: true }).click();
  await expect(
    page.getByText("Synthetic replay · fabricated prices", { exact: true }),
  ).toBeVisible();
  const original = "Apple should do better than the market. This is my replay.";
  await page.getByLabel("Your market call", { exact: true }).fill(original);
  await page
    .getByLabel("Why do you expect this? · optional", { exact: true })
    .fill("Services growth could support earnings.");
  await page
    .getByLabel("What would change your view? · optional", { exact: true })
    .fill("Services growth materially slows.");
  await page.getByLabel("Confidence (%)", { exact: false }).fill("70");
  await lockReplay(page);
  const replayUrl = page.url();
  await expect(page.locator(".locked-claim blockquote")).toHaveText(original);
  await expect(page.getByText("Browser confirmation time", { exact: true })).toBeVisible();
  await expect(page.getByText("Simulated market start", { exact: true })).toBeVisible();
  await expect(page.locator(".result-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Run resolution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The saved test was met." })).toBeVisible();
  await expect(page.locator(".result-metrics")).toContainText("+10%");
  await expect(page.locator(".result-metrics")).toContainText("+5%");
  await expect(page.locator(".result-metrics")).toContainText("+5 pp");
  await expect(
    page.getByRole("region", { name: "Saved calculation inputs", exact: true }).locator("tbody tr"),
  ).toHaveCount(4);
  await expect(page.locator(".replay-reasoning")).toContainText(
    "Services growth materially slows.",
  );
  await page.reload();
  await expect(page.locator(".locked-claim blockquote")).toHaveText(original);
  await expect(page.getByRole("heading", { name: "The saved test was met." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run resolution", exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/replay-result-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Open demo author history", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Alex Morgan", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: original, exact: true })).toBeVisible();
  await expect(page.locator(".replay-record-card")).toHaveCount(8);
  await expect(
    page.locator(".replay-record-card").filter({ hasText: "NVIDIA will underperform" }),
  ).toContainText("Not met");
  await expect(
    page.locator(".replay-record-card").filter({ hasText: "WTI will finish" }),
  ).toContainText("Unclear");
  await page.getByRole("button", { name: "Your live record", exact: true }).click();
  await expect(
    page.getByText("Live accounts are not connected in this preview.", { exact: false }),
  ).toBeVisible();
  await page.goto(replayUrl);
  await expect(page.locator(".locked-claim")).toContainText("70%");
  await page.evaluate(() => {
    const saved = sessionStorage.getItem("provenalpha:synthetic-replays:v1");
    if (!saved) throw new Error("Expected a confirmed replay in tab storage.");
    sessionStorage.setItem("marktothesis:synthetic-replays:v1", saved);
    sessionStorage.removeItem("provenalpha:synthetic-replays:v1");
  });
  await page.reload();
  await expect(page.locator(".locked-claim blockquote")).toHaveText(original);
  await expect(page.getByRole("heading", { name: "The saved test was met." })).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("provenalpha:synthetic-replays:v1")),
  ).not.toBeNull();
  expect(errors).toEqual([]);
});

test("editing before confirmation preserves field changes and a miss remains locked", async ({
  page,
}) => {
  await page.goto("/replay");
  await page.getByRole("button", { name: "Underperform", exact: true }).click();
  await page.getByLabel("Duration", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Review replay terms", exact: true }).click();
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  await expect(page.getByLabel("Duration", { exact: true })).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Underperform", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByLabel("Your market call", { exact: true })
    .fill("My revised original wording before confirmation.");
  await lockReplay(page);
  await page.getByRole("button", { name: "Run resolution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The saved test was not met." })).toBeVisible();
  await expect(page.locator(".locked-claim blockquote")).toHaveText(
    "My revised original wording before confirmation.",
  );
  await expect(page.getByRole("button", { name: "Edit draft", exact: true })).toHaveCount(0);
});

test("a mobile Treasury range resolves in yield units and exposes daily checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/replay");
  await page.getByRole("button", { name: "Range", exact: true }).click();
  await page
    .getByLabel("Instrument", { exact: true })
    .selectOption("us:treasury:constant-maturity:5y");
  await page.getByLabel("Lower bound", { exact: true }).fill("3.8");
  await page.getByLabel("Upper bound", { exact: true }).fill("4.3");
  await page
    .getByLabel("When should the condition hold?", { exact: true })
    .selectOption("every_daily_observation");
  await lockReplay(page);
  await page.getByRole("button", { name: "Run resolution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The saved test was met." })).toBeVisible();
  await expect(page.locator(".result-metrics")).toContainText("4.2 % yield");
  await expect(
    page
      .getByRole("region", { name: "Individual condition checks", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/replay-result-mobile.png", fullPage: true });
});

test("preloaded misses, missing data, unclear data, and position holds keep distinct outcomes", async ({
  page,
}) => {
  await page.goto("/replay/sample-gold-miss");
  await expect(page.getByRole("heading", { name: "The saved test was not met." })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Individual condition checks", exact: true }),
  ).toContainText("Outside bounds");
  await page.goto("/replay/sample-eth-pending");
  await expect(page.getByRole("heading", { name: "The result stays pending." })).toBeVisible();
  await expect(page.locator(".result-panel")).toContainText("Awaiting data");
  await expect(page.locator(".missing-observations")).toContainText("Jan 5, 2024");
  await page.goto("/replay/sample-oil-unclear");
  await expect(page.getByRole("heading", { name: "A fair result is unavailable." })).toBeVisible();
  await expect(page.locator(".result-metrics")).toHaveCount(0);
  await page.goto("/replay/sample-bitcoin-hold");
  await expect(
    page.getByRole("heading", { name: "A position statement has no performance score." }),
  ).toBeVisible();
  await expect(page.locator(".result-metrics")).toHaveCount(0);
});

test("multi-year claims stay pending outside the limited replay dataset", async ({ page }) => {
  await page.goto("/replay");
  await page.getByLabel("Duration", { exact: true }).fill("5");
  await page.getByLabel("Calendar unit", { exact: true }).selectOption("years");
  await lockReplay(page);
  await page.getByRole("button", { name: "Run resolution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The result stays pending." })).toBeVisible();
  await expect(page.locator(".result-window")).toContainText("Jan 2, 2029");
  await expect(page.locator(".result-metrics")).toHaveCount(0);
});

test("unavailable tab storage is disclosed and does not fake a saved public record", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Disabled for this test", "SecurityError");
    };
  });
  await page.goto("/replay");
  await lockReplay(page);
  await expect(page.getByRole("status")).toContainText("held in memory");
  await page.getByRole("button", { name: "Run resolution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The saved test was met." })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "This replay is not available in this tab" }),
  ).toBeVisible();
});

test("invalid stored metadata restores the full synthetic history", async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "provenalpha:synthetic-replays:v1",
      JSON.stringify({ version: 1, records: [{ invalid: true }] }),
    ),
  );
  await page.goto("/profile");
  await expect(page.getByRole("status")).toContainText("synthetic examples have been restored");
  await expect(page.locator(".replay-record-card")).toHaveCount(7);
  await expect(
    page.locator(".replay-record-card").filter({ hasText: "Gold will stay" }),
  ).toContainText("Not met");
});
