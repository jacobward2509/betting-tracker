import { test, expect } from '@playwright/test';
import { TopBannerPage } from '@pages/top-banner.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Top Banner Tester';

// This suite exercises the header/user menu as seen by a freshly-signed-up
// account, so it must always start logged out regardless of the project's
// default storageState (see playwright-ui-test-generation.md §4). A fresh
// account per test avoids collisions with parallel tests mutating shared
// account state (display name / bet preferences).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Top Banner', () => {
  let token: string | undefined;
  let email: string;

  test.beforeEach(async ({ page }) => {
    email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Cosmetic - Header renders correctly on page load, menu closed by default', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.expectHeaderCosmeticElements();
    await expect(topBannerPage.userMenuToggleButton, 'Toggle button should show the display name').toContainText(
      VALID_NAME,
    );
  });

  test('Cosmetic - Dropdown renders signed-in email, hidden unsaved banner, and Sign Out once opened', async ({
    page,
  }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.expectDropdownCosmeticElements(email);
  });

  test('Cosmetic - Display Name section renders in view mode by default', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.expectDisplayNameViewModeCosmeticElements(VALID_NAME);
  });

  test('Cosmetic - Visual Preference section renders collapsed by default', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.expectVisualPreferencesCollapsedCosmeticElements();
  });

  test('Cosmetic - Bet Preferences section renders collapsed by default', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.expectBetPreferencesCollapsedCosmeticElements();
  });
});
