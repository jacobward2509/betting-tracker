import { test, expect } from '@playwright/test';
import { TopBannerPage } from '@pages/top-banner.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Top Banner Tester';

// Exercises the Visual Preference section (theme, persisted to localStorage),
// so it must always start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Top Banner - Visual Preferences', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Section expands/collapses and shows the correct default theme', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();

    await topBannerPage.toggleVisualPreferences();

    await expect(topBannerPage.themeSelect, 'Theme select should become visible').toBeVisible();
    await expect(
      topBannerPage.themeSelect.locator('option'),
      'Theme select should list Light and Dark in order',
    ).toHaveText(['Light', 'Dark']);
    await expect(topBannerPage.themeSelect, 'Theme select should default to Light').toHaveValue('light');
    await expect(
      topBannerPage.visualPreferencesToggle,
      'Toggle label should read "Hide" while expanded',
    ).toHaveText('Hide');

    await topBannerPage.toggleVisualPreferences();

    await expect(topBannerPage.themeSelect, 'Theme select should be hidden again after "Hide"').toHaveCount(0);
  });

  test('Save button is disabled until dirty, and applies + persists the theme on save', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleVisualPreferences();

    await expect(
      topBannerPage.saveVisualPreferencesButton,
      'Save button should be disabled by default (not dirty)',
    ).toBeDisabled();

    await topBannerPage.selectTheme('Dark');

    await expect(
      topBannerPage.saveVisualPreferencesButton,
      'Save button should be enabled after selecting a different theme',
    ).toBeEnabled();

    await topBannerPage.saveVisualPreferences();

    await expect(
      page.locator('html'),
      '<html> should gain the "dark" class after saving',
    ).toHaveClass(/dark/);
    const storedTheme = await page.evaluate(() => localStorage.getItem('theme-preference'));
    expect(storedTheme, 'localStorage theme-preference should be persisted as "dark"').toBe('dark');
    await expect(
      topBannerPage.saveVisualPreferencesButton,
      'Save button should become disabled again once saved (no longer dirty)',
    ).toBeDisabled();
  });

  test('Saved theme selection persists across menu close/reopen', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleVisualPreferences();
    await topBannerPage.selectTheme('Dark');
    await topBannerPage.saveVisualPreferences();

    await topBannerPage.closeUserMenuByClickingOutside();
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleVisualPreferences();

    await expect(
      topBannerPage.themeSelect,
      'Theme select should show Dark as selected, matching the persisted value',
    ).toHaveValue('dark');
  });
});
