import { test, expect } from '@playwright/test';
import { TopBannerPage } from '@pages/top-banner.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Top Banner Tester';

// Exercises the Bet Preferences section (odds format, bookmakers, defaults),
// so it must always start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4). A fresh account per
// test guarantees the "brand-new user" default config the scenarios rely on.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Top Banner - Bet Preferences', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Section expands and loads current config', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleBetPreferences();

    await expect(topBannerPage.oddsFormatSelect, 'Odds format select should become visible').toBeVisible();
    for (const bookmaker of TopBannerPage.EXPECTED_BOOKMAKERS) {
      await expect(
        topBannerPage.bookmakerCheckbox(bookmaker),
        `"${bookmaker}" checkbox should be visible`,
      ).toBeVisible();
    }
    await expect(topBannerPage.defaultBookmakerSelect, 'Default Bookmaker select should be visible').toBeVisible();
    await expect(topBannerPage.defaultBetTypeSelect, 'Default Bet Type select should be visible').toBeVisible();
    await expect(topBannerPage.defaultStakeInput, 'Default Stake input should be visible').toBeVisible();
  });

  test('Enabled Bookmakers checkboxes reflect all 23 tracked bookmakers, all enabled by default for a new account', async ({
    page,
  }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleBetPreferences();

    for (const bookmaker of TopBannerPage.EXPECTED_BOOKMAKERS) {
      await expect(
        topBannerPage.bookmakerCheckbox(bookmaker),
        `"${bookmaker}" checkbox should be checked by default`,
      ).toBeChecked();
      await expect(
        topBannerPage.bookmakerCheckbox(bookmaker),
        `"${bookmaker}" checkbox should be enabled (not the last remaining one)`,
      ).toBeEnabled();
    }
  });

  test('Unchecking bookmakers down to the last one disables and locks it, keeping it checked', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleBetPreferences();

    const bookmakersExceptLast = TopBannerPage.EXPECTED_BOOKMAKERS.slice(0, -1);
    const lastBookmaker = TopBannerPage.EXPECTED_BOOKMAKERS[TopBannerPage.EXPECTED_BOOKMAKERS.length - 1];
    const lastBookmakerLabel = TopBannerPage.EXPECTED_BOOKMAKER_LABELS[TopBannerPage.EXPECTED_BOOKMAKER_LABELS.length - 1];

    for (const bookmaker of bookmakersExceptLast) {
      await topBannerPage.toggleBookmaker(bookmaker);
    }

    // Regression test for a previously-fixed bug: the last remaining
    // bookmaker's checkbox used to visually flip to unchecked despite the
    // underlying state correctly staying enabled — see the "Resolved Issues"
    // section of ui-test-plan-top-banner.md.
    await expect(
      topBannerPage.bookmakerCheckbox(lastBookmaker),
      'The last remaining bookmaker should stay checked',
    ).toBeChecked();
    await expect(
      topBannerPage.bookmakerCheckbox(lastBookmaker),
      'The last remaining bookmaker checkbox should become disabled to prevent unchecking it',
    ).toBeDisabled();
    await expect(
      topBannerPage.defaultBookmakerSelect.locator('option'),
      'Default Bookmaker select should only offer the one remaining bookmaker',
    ).toHaveText([lastBookmakerLabel]);
  });

  test('Default Bookmaker auto-reassigns when the current default is disabled', async ({ page }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleBetPreferences();

    await expect(
      topBannerPage.defaultBookmakerSelect,
      'Default Bookmaker should default to Bet365',
    ).toHaveValue(TopBannerPage.DEFAULT_BOOKMAKER);

    await topBannerPage.toggleBookmaker(TopBannerPage.DEFAULT_BOOKMAKER);

    await expect(
      topBannerPage.defaultBookmakerSelect,
      'Default Bookmaker should auto-reassign to the next remaining enabled bookmaker',
    ).toHaveValue(TopBannerPage.EXPECTED_BOOKMAKERS[1]);
  });

  test('Unsaved bet-preference changes show the warning banner, which clears on save and on reopen without saving', async ({
    page,
  }) => {
    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.toggleBetPreferences();

    await topBannerPage.toggleBookmaker('Betfair');

    await expect(
      topBannerPage.unsavedChangesBanner,
      'Unsaved changes banner should become visible once the section is dirty',
    ).toBeVisible();

    await topBannerPage.saveBetPreferences();

    await expect(
      topBannerPage.unsavedChangesBanner,
      'Unsaved changes banner should disappear after a successful save',
    ).toHaveCount(0);

    // Make a dirty change again, then close without saving.
    await topBannerPage.toggleBetPreferences();
    await topBannerPage.toggleBookmaker('Ladbrokes');
    await expect(
      topBannerPage.unsavedChangesBanner,
      'Unsaved changes banner should reappear once dirty again',
    ).toBeVisible();

    await topBannerPage.closeUserMenuByClickingOutside();
    await topBannerPage.openUserMenu();

    await expect(
      topBannerPage.unsavedChangesBanner,
      'Unsaved changes banner should be absent after reopening without saving (state reloaded fresh)',
    ).toHaveCount(0);
    await topBannerPage.toggleBetPreferences();
    await expect(
      topBannerPage.bookmakerCheckbox('Ladbrokes'),
      'Ladbrokes should be re-enabled after reopening, since the unsaved uncheck was discarded',
    ).toBeChecked();
  });
});
