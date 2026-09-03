import { test } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { seededBetsFixture } from '@seed-data/bets';
import { deleteAccount, seedBets } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Bets Row Selection Tester';

// Exercises the Bets page's per-row/select-all checkboxes and "Edit"/"Delete"
// buttons (desktop table and mobile card view) in their default (unselected)
// state, so it must always start logged out regardless of the project's
// default storageState (see playwright-ui-test-generation.md §4). A fresh
// account per test, seeded with the standard 3-bet fixture, is enough to
// exercise every row/card's default cosmetic state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Bets Row Selection', () => {
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

  test('Cosmetic - Desktop selection controls and action buttons render correctly by default', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.expectDesktopSelectionCosmeticElements(3);
  });

  test('Cosmetic - Mobile selection controls and action buttons render correctly by default', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await BetsPage.expectBetsLoaded(page, () => page.reload());

    const betsPage = new BetsPage(page);
    await betsPage.expectMobileSelectionCosmeticElements(3);
  });
});
