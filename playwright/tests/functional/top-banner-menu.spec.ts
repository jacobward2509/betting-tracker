import { test, expect } from '@playwright/test';
import { TopBannerPage } from '@pages/top-banner.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Top Banner Tester';

// Exercises the header/user menu as seen by a freshly-signed-up account, so
// it must always start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Top Banner - Menu Open/Close', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Clicking outside the dropdown closes it', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await expect(topBannerPage.userMenuDropdown, 'Dropdown should be visible once opened').toBeVisible();

    await topBannerPage.closeUserMenuByClickingOutside();

    await expect(
      topBannerPage.userMenuDropdown,
      'Dropdown should have zero elements in the DOM after an outside click',
    ).toHaveCount(0);
  });

  test('Reopening the dropdown resets Display Name edit mode and its error', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.startEditingDisplayName();
    await topBannerPage.fillDisplayNameInput('A');
    await topBannerPage.saveDisplayName();

    await expect(
      topBannerPage.displayNameError,
      'Display name error should be visible after an invalid save attempt',
    ).toBeVisible();

    await topBannerPage.closeUserMenuByClickingOutside();
    await topBannerPage.openUserMenu();

    await expect(
      topBannerPage.displayNameInput,
      'Display name input should not be present in the DOM after reopening (back in view mode)',
    ).toHaveCount(0);
    await expect(
      topBannerPage.displayNameText,
      'Display name should show the original saved name after reopening',
    ).toHaveText(VALID_NAME);
  });
});
