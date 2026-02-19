import { expect, test } from "@playwright/test";

const BASE_URL = "http://localhost:5173";
const AUTH_TOKEN = "smoke-token";

type Bet = {
  id: string;
  fixture: string;
  selection: string;
  bookmaker: string;
  stakeType: string;
  betType: string;
  playerPropMarket: string | null;
  stake: number;
  odds: number;
  potentialReturn: number;
  result: string;
  cashOutValue: number | null;
  profit: number | null;
  placedAt: string;
};

// Fixed dataset used by the smoke suite so table assertions are deterministic.
// We return 12 rows to validate default pagination (10 per page => "Page 1 of 2").
const mockBets: Bet[] = Array.from({ length: 12 }).map((_, index) => ({
  id: `bet-${index + 1}`,
  fixture: `Fixture ${index + 1}`,
  selection: `Selection ${index + 1}`,
  bookmaker:
    index % 4 === 0
      ? "Bet365"
      : index % 4 === 1
        ? "Betfair"
        : index % 4 === 2
          ? "Paddy Power"
          : "SkyBet",
  stakeType: index % 3 === 0 ? "FREE" : "NORMAL",
  betType: "Player Prop",
  playerPropMarket: "Shots Over",
  stake: 5 + index,
  odds: 2 + index * 0.1,
  potentialReturn: (5 + index) * (2 + index * 0.1),
  result: index % 4 === 0 ? "WON" : index % 4 === 1 ? "LOST" : index % 4 === 2 ? "VOID" : "OPEN",
  cashOutValue: index % 4 === 2 ? 7 + index : null,
  profit: index % 4 === 0 ? 6 + index : index % 4 === 1 ? -(5 + index) : index % 4 === 2 ? 2 : null,
  placedAt: new Date(2026, 0, index + 1).toISOString(),
}));

const setupRoutes = async (page: Parameters<typeof test>[0]["page"]) => {
  // Mock authenticated user lookup so the app can boot in logged-in mode
  // without hitting a real backend/auth store.
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", name: "Jacob", email: "jacob@example.com" },
      }),
    });
  });

  // Mock bets GET response: this is the source of truth the smoke test
  // compares against when asserting visible table values.
  await page.route("**/api/bets", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockBets),
      });
      return;
    }
    await route.fallback();
  });

  // Mock logout endpoint because user-menu assertions open/close auth actions.
  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
};

test.describe("Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Seed localStorage token before app scripts execute.
    // Route guard/auth store reads this and attempts /api/auth/me (mocked above).
    await page.addInitScript((token) => {
      window.localStorage.setItem("auth-token", token);
      window.localStorage.setItem("odds-format-preference", "decimal");
    }, AUTH_TOKEN);

    // Register all API mocks before navigation to avoid race conditions.
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/bets`);
  });

  test("validates top-level UI cosmetics and table defaults", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Bets Tracker" })).toBeVisible();
    await expect(
      page.getByText("The go-to site to track your betting Profit and Loss across all bookmakers."),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Bets" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Overall Stats" })).toBeVisible();

    const userMenuButton = page.getByRole("button", { name: /Jacob/i }).first();
    await expect(userMenuButton).toBeVisible();
    await userMenuButton.click();
    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByText("jacob@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
    await userMenuButton.click();

    await expect(page.getByRole("button", { name: "Add Bet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Columns" })).toBeVisible();
    await expect(page.locator("#rows-per-page-top")).toHaveValue("10");
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "<<", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "<", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: ">", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: ">>", exact: true })).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(10);

    const fixtureCells = page.locator("tbody tr td:nth-child(2)");
    await expect(fixtureCells.nth(0)).toHaveText("Fixture 1");
    await expect(fixtureCells.nth(1)).toHaveText("Fixture 2");
    await expect(fixtureCells.nth(2)).toHaveText("Fixture 3");

    const bookmakerCells = page.locator("tbody tr td:nth-child(3)");
    await expect(bookmakerCells.nth(0)).toContainText(mockBets[0].bookmaker);
    await expect(bookmakerCells.nth(1)).toContainText(mockBets[1].bookmaker);
    await expect(bookmakerCells.nth(2)).toContainText(mockBets[2].bookmaker);

    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(10);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(10);
  });
});
