import { test } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Add Bet Smoke Tester';

// Exercises the Add Bet modal's own default-state rendering, so it must
// always start logged out regardless of the project's default storageState
// (see playwright-ui-test-generation.md §4). A fresh account per test
// guarantees the "brand-new user" defaults (no saved Bookmaker/Bet
// Type/Stake preferences) these scenarios assert against — see
// ui-test-plan-add-bet.md Scenarios 1-2.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Add Bet Modal', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
    await BetsPage.expectBetsLoaded(page, () => page.goto('/bets'));
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Cosmetic - Modal opens with default (Player Prop) state rendered correctly', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    await betsPage.addBetModal.expectDefaultCosmeticElements();
  });

  test('Cosmetic - Bet Type dropdown shows correct default and full option list', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    await betsPage.addBetModal.expectBetTypeOptions();
  });
});
