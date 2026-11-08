import { expect, test } from "@playwright/test";
import { defaultTerms } from "../../src/demo/claims";
import { instruments } from "../../src/features/market-data/catalog";
import type { FeedRecord } from "../../src/features/feed/contracts";

const author = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Fixture Analyst",
  handle: "fixture_analyst",
  bio: "A clearly labeled browser fixture.",
};
const timestamp = "2026-11-07T18:00:00.123456+00:00";
const uid = (value: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(value).padStart(12, "0")}`;
function claim(index: number, visibility: "public" | "private" = "public"): FeedRecord {
  return {
    version: {
      id: uid(index + 100),
      claimId: uid(index),
      authorId: author.id,
      version: 1,
      originalText: `Fixture call ${index}: AAPL to outperform SPY.`,
      terms: {
        ...defaultTerms,
        instrument: instruments.aapl,
        prediction: { kind: "outperform", metric: "price_return", benchmark: instruments.spy },
        horizon: { kind: "duration", value: 30, unit: "days" },
        confidencePct: 70,
        assumptions: [],
      },
      committedAt: timestamp,
      publishedAt: visibility === "public" ? timestamp : null,
      visibility,
      context: { kind: "live" },
      supersedesVersionId: null,
    },
    status: "awaiting_start",
    marketBindings: {},
    supersedesClaimId: null,
    author,
  };
}
const pageResult = (claims: FeedRecord[], extra = {}) => ({
  configured: true,
  claims,
  nextCursor: null,
  summary: null,
  ...extra,
});

test("public live feed shows authors and confidence, requests server filters, and resets pagination", async ({
  page,
}) => {
  const urls: URL[] = [];
  await page.route("**/api/claims?*", (route) => {
    const url = new URL(route.request().url());
    urls.push(url);
    return route.fulfill({
      json: url.searchParams.get("q") === "not found" ? pageResult([]) : pageResult([claim(1)]),
    });
  });
  await page.goto("/");
  const feed = page.locator(".live-feed");
  await expect(feed.locator(".live-claim-card")).toHaveCount(1);
  await expect(
    feed.getByRole("link", { name: "Fixture Analyst @fixture_analyst" }),
  ).toHaveAttribute("href", "/u/fixture_analyst");
  await expect(feed.locator(".live-card-confidence")).toContainText("70%");
  await expect(feed.locator("time")).toHaveAttribute("datetime", timestamp);
  await feed.getByLabel("Search original calls", { exact: true }).fill("not found");
  await feed.getByLabel("Claim type", { exact: true }).selectOption("range");
  await feed.getByLabel("Asset", { exact: true }).selectOption(instruments.aapl.id);
  await feed.getByLabel("Horizon unit", { exact: true }).selectOption("years");
  await feed.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(feed.getByRole("heading", { name: "No calls match these filters" })).toBeVisible();
  expect(urls.at(-1)?.searchParams.get("q")).toBe("not found");
  expect(urls.at(-1)?.searchParams.get("kind")).toBe("range");
  expect(urls.at(-1)?.searchParams.get("instrumentId")).toBe(instruments.aapl.id);
  expect(urls.at(-1)?.searchParams.has("beforeId")).toBe(false);
  await feed.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(feed.locator(".live-claim-card")).toHaveCount(1);
  await expect(feed.getByLabel("Search original calls", { exact: true })).toHaveValue("");
  expect(urls.at(-1)?.searchParams.has("q")).toBe(false);
  await page.screenshot({ path: "test-results/live-feed-desktop.png", fullPage: true });
});

test("older-page failures keep loaded calls and retry the same precise cursor without duplicates", async ({
  page,
}) => {
  const olderUrls: string[] = [];
  await page.route("**/api/claims?*", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("beforeId")) {
      olderUrls.push(url.search);
      return olderUrls.length === 1
        ? route.fulfill({ status: 503, json: { error: "Fixture page outage" } })
        : route.fulfill({ json: pageResult([claim(2), claim(3)]) });
    }
    return route.fulfill({
      json: pageResult([claim(1), claim(2)], { nextCursor: { createdAt: timestamp, id: uid(2) } }),
    });
  });
  await page.goto("/");
  const feed = page.locator(".live-feed");
  await expect(feed.locator(".live-claim-card")).toHaveCount(2);
  await feed.getByRole("button", { name: "Load older claims" }).click();
  await expect(feed.getByRole("alert")).toContainText("Fixture page outage");
  await expect(feed.locator(".live-claim-card")).toHaveCount(2);
  await feed.getByRole("button", { name: "Retry loading claims" }).click();
  await expect(feed.locator(".live-claim-card")).toHaveCount(3);
  expect(olderUrls[1]).toBe(olderUrls[0]);
  expect(new URLSearchParams(olderUrls[1]).get("beforeTime")).toBe(timestamp);
  await expect(feed.getByRole("button", { name: "Load older claims" })).toHaveCount(0);
});

test("owner summary covers all history, private filters stay local to owner scope, and sign-out clears records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let signedIn = true;
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: signedIn ? { id: author.id, email: "fixture@example.test" } : null,
        profile: signedIn ? author : null,
      },
    }),
  );
  const requestedScopes: string[] = [];
  await page.route("**/api/claims?*", (route) => {
    const url = new URL(route.request().url());
    requestedScopes.push(url.searchParams.get("scope") ?? "public");
    if (!signedIn) return route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
    const records =
      url.searchParams.get("visibility") === "private"
        ? [claim(2, "private")]
        : [claim(1), claim(2, "private")];
    return route.fulfill({
      json: pageResult(records, { summary: { awaitingStart: 37, unscored: 5 } }),
    });
  });
  await page.goto("/profile?record=demo");
  await page.getByRole("button", { name: "Your live record", exact: true }).click();
  await expect(page.getByRole("heading", { name: author.displayName, exact: true })).toBeVisible();
  const summary = page.getByRole("region", { name: "Complete record summary" });
  await expect(summary.locator("dd").first()).toHaveText("42");
  await expect(page.locator(".live-claim-card")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "View public profile" })).toHaveAttribute(
    "href",
    "/u/fixture_analyst",
  );
  await page.getByLabel("Claim visibility", { exact: true }).selectOption("private");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.locator(".live-claim-card")).toHaveCount(1);
  await expect(page.locator(".live-claim-card")).toContainText("Private · owner only");
  await expect(summary.locator("dd").first()).toHaveText("42");
  expect(requestedScopes.every((scope) => scope === "mine")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/owner-record-mobile.png", fullPage: true });
  signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new Event("provenalpha:account-changed")));
  await expect(
    page.getByRole("heading", { name: "Sign in to see your saved record" }),
  ).toBeVisible();
  await expect(page.locator(".live-claim-card")).toHaveCount(0);
  await expect(summary).toHaveCount(0);
});
