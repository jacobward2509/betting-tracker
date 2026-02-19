import { expect, test } from "@playwright/test";

const BASE_URL = "http://localhost:5173";
const AUTH_TOKEN = "functional-token";

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

const baseBet = (): Bet => ({
  id: "seed-1",
  fixture: "Arsenal vs Chelsea",
  selection: "Initial Selection",
  bookmaker: "Bet365",
  stakeType: "NORMAL",
  betType: "Player Prop",
  playerPropMarket: "Shots Over",
  stake: 10,
  odds: 2.5,
  potentialReturn: 25,
  result: "OPEN",
  cashOutValue: null,
  profit: null,
  placedAt: new Date("2026-02-01T00:00:00.000Z").toISOString(),
});

const setupStatefulRoutes = async (
  page: Parameters<typeof test>[0]["page"],
  initialBets: Bet[],
) => {
  const bets: Bet[] = [...initialBets];
  let idCounter = 1000;

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", name: "Jacob", email: "jacob@example.com" },
      }),
    });
  });

  await page.route("**/api/bookmakers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, bookmakers: "Bet365" },
        { id: 2, bookmakers: "Betfair" },
        { id: 3, bookmakers: "Paddy Power" },
      ]),
    });
  });

  await page.route("**/api/bet-types", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, betTypes: "Accumulator" },
        { id: 2, betTypes: "Bet Builder" },
        { id: 3, betTypes: "Player Prop" },
      ]),
    });
  });

  await page.route("**/api/player-prop-markets", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: 1, markets: "Shots Over" }]),
    });
  });

  await page.route("**/api/bets", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(bets),
      });
      return;
    }

    if (method === "POST") {
      const payload = (await route.request().postDataJSON()) as Record<string, any>;
      const created: Bet = {
        id: `bet-${idCounter++}`,
        fixture: String(payload.fixture || ""),
        selection: String(payload.selection || ""),
        bookmaker: String(payload.bookmaker || "Bet365"),
        stakeType: String(payload.stakeType || "NORMAL"),
        betType: String(payload.betType || "Player Prop"),
        playerPropMarket: payload.playerPropMarket ?? null,
        stake: Number(payload.stake || 0),
        odds: Number(payload.odds || 1),
        potentialReturn: Number(payload.potentialReturn || 0),
        result: String(payload.result || "OPEN"),
        cashOutValue: payload.cashOutValue == null ? null : Number(payload.cashOutValue),
        profit: null,
        placedAt: String(payload.placedAt || new Date().toISOString()),
      };
      bets.push(created);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/bets/*", async (route) => {
    const method = route.request().method();
    const id = route.request().url().split("/").pop() || "";
    const index = bets.findIndex((b) => b.id === id);

    if (method === "PUT") {
      const payload = (await route.request().postDataJSON()) as Record<string, any>;
      if (index >= 0) {
        bets[index] = {
          ...bets[index],
          fixture: String(payload.fixture ?? bets[index].fixture),
          selection: String(payload.selection ?? bets[index].selection),
          bookmaker: String(payload.bookmaker ?? bets[index].bookmaker),
          stakeType: String(payload.stakeType ?? bets[index].stakeType),
          stake: Number(payload.stake ?? bets[index].stake),
          odds: Number(payload.odds ?? bets[index].odds),
          result: String(payload.result ?? bets[index].result),
          cashOutValue: payload.cashOutValue == null ? null : Number(payload.cashOutValue),
        };
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(index >= 0 ? bets[index] : {}),
      });
      return;
    }

    if (method === "DELETE") {
      if (index >= 0) bets.splice(index, 1);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
};

test.describe("Functional Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem("auth-token", token);
      window.localStorage.setItem("odds-format-preference", "decimal");
    }, AUTH_TOKEN);
  });

  test("adds a bet", async ({ page }) => {
    await setupStatefulRoutes(page, [baseBet()]);
    await page.goto(`${BASE_URL}/bets`);

    await page.getByRole("button", { name: "Add Bet" }).click();
    await page.locator('[data-test-id="input-date"]').fill("2026-02-17");
    await page.locator('[data-test-id="input-bet-type"]').selectOption("Accumulator");
    await page.locator('[data-test-id="input-bookmaker"]').selectOption("Bet365");
    await page.locator('[data-test-id="submit-add-bet"]').click();

    await expect(page.getByRole("cell", { name: "Accumulator" }).first()).toBeVisible();
  });

  test("edits a bet", async ({ page }) => {
    await setupStatefulRoutes(page, [baseBet()]);
    await page.goto(`${BASE_URL}/bets`);

    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.locator('[data-test-id="edit-input-fixture"]').fill("Edited Fixture");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("Edited Fixture")).toBeVisible();
  });

  test("deletes a bet", async ({ page }) => {
    await setupStatefulRoutes(page, [baseBet()]);
    await page.goto(`${BASE_URL}/bets`);

    await expect(page.getByText("Arsenal vs Chelsea")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByRole("button", { name: "Yes, Delete" }).click();

    await expect(page.getByText("Arsenal vs Chelsea")).toHaveCount(0);
  });
});
