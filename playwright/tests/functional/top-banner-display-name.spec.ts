import { test, expect } from '@playwright/test';
import { TopBannerPage } from '@pages/top-banner.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Top Banner Tester';

// Exercises the Display Name section, so it must always start logged out
// regardless of the project's default storageState (see
// playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Top Banner - Display Name', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });

    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.startEditingDisplayName();
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Validation error on a too-short (1-character) name', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.fillDisplayNameInput('A');
    await topBannerPage.saveDisplayName();

    await expect(
      topBannerPage.displayNameError,
      'Display name error should read the too-short validation message',
    ).toHaveText('Name must be at least 2 characters long.');
    await expect(
      topBannerPage.displayNameText,
      'Display name should not have been saved',
    ).toHaveCount(0);
  });

  test('Saves successfully and returns to view mode', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    const newName = 'Updated Banner Tester';

    await topBannerPage.fillDisplayNameInput(newName);
    await topBannerPage.saveDisplayName();

    await expect(
      topBannerPage.displayNameInput,
      'Display name input should be removed from the DOM (back to view mode)',
    ).toHaveCount(0);
    await expect(topBannerPage.displayNameText, `Display name should now read "${newName}"`).toHaveText(newName);
    await expect(
      topBannerPage.userMenuToggleButton,
      'Toggle button text should update to the new name',
    ).toContainText(newName);
  });

  test('Cancel discards the edit', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.fillDisplayNameInput('Some Unsaved Name');
    await topBannerPage.cancelEditingDisplayName();

    await expect(
      topBannerPage.displayNameInput,
      'Display name input should be removed from the DOM (back to view mode)',
    ).toHaveCount(0);
    await expect(
      topBannerPage.displayNameText,
      'Display name should still show the original (unsaved) name',
    ).toHaveText(VALID_NAME);
  });
});
