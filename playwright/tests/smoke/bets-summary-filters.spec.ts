import { test } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { seededBetsFixture } from '@seed-data/bets';
import { deleteAccount, seedBets } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Bets Summary Tester';

// Exercises the Bets page's summary stats bar and default (collapsed)
// filters panel state, so it must always start logged out regardless of the
// project's default storageState (see playwright-ui-test-generation.md §4).
// A fresh account per test, seeded with a known/deterministic set of bets,
// guarantees the exact Total Bets / Favourite Bookie / Total P/L values and
// filter option lists these scenarios assert against.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Bets Summary & Filters', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page, request }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
    if (token) await seedBets(request, token, seededBetsFixture());
    await BetsPage.expectBetsLoaded(page, () => page.goto('/bets'));
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Cosmetic - Summary stats bar renders correctly', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.expectSummaryStatsCosmeticElements({
      totalBets: '3',
      favouriteBookie: 'Bet365',
      totalProfitLossText: '£ 5.00',
      totalProfitLossClass: 'text-green-700',
    });
  });

  test('Cosmetic - Filters panel renders correctly in its default (collapsed) state', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.expectFiltersCollapsedCosmeticElements();
  });
});
