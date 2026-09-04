import { test } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { seededPaginatedBetsFixture } from '@seed-data/bets';
import { deleteAccount, seedBets } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Bets Table Display Tester';

// Exercises the Bets page's table controls bar (rows-per-page selector,
// Columns button/menu), desktop table headers/sort indicators, and mobile
// card view, so it must always start logged out regardless of the
// project's default storageState (see playwright-ui-test-generation.md §4).
// A fresh account per test, seeded with 12 bets (distinct stake values),
// guarantees a deterministic 2-page pagination state to assert against.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Bets Table Display', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page, request }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
    if (token) await seedBets(request, token, seededPaginatedBetsFixture());
    await BetsPage.expectBetsLoaded(page, () => page.goto('/bets'));
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Cosmetic - Table controls bar and desktop table render correctly by default', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.expectTableControlsAndHeadersCosmeticElements();
    await betsPage.pagination.expectPageInfo(1, 2);
    await betsPage.pagination.expectBoundaryState({ atFirstPage: true, atLastPage: false });
  });

  test('Cosmetic - Mobile card view renders correctly on small viewports, desktop table hidden', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await BetsPage.expectBetsLoaded(page, () => page.reload());

    const betsPage = new BetsPage(page);
    await betsPage.mobileCards.expectCosmeticElements(10);
  });
});

