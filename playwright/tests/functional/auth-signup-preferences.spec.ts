import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

const VALID_PASSWORD = 'a-valid-password-123';

// This suite exercises the unauthenticated → authenticated signup flow
// itself, so it must always start logged out regardless of the project's
// default storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Signup - Betting Preferences', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto('signup');
  });

  test('Betting Preferences sub-fields become visible after clicking Configure', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.togglePreferences();

    await expect(authPage.togglePreferencesButton, 'Toggle preferences button should read "Hide"').toHaveText('Hide');

    for (const bookmaker of AuthPage.EXPECTED_BOOKMAKERS) {
      await expect(authPage.bookmakerCheckbox(bookmaker), `"${bookmaker}" checkbox should be checked by default`).toBeChecked();
    }

    await expect(
      authPage.defaultBookmakerSelect.locator('option'),
      'Default Bookmaker select should list all bookmakers in order',
    ).toHaveText([...AuthPage.EXPECTED_BOOKMAKERS]);
    await expect(authPage.defaultBookmakerSelect, 'Default Bookmaker select should default to Bet365').toHaveValue(
      AuthPage.DEFAULT_BOOKMAKER,
    );

    await expect(
      authPage.defaultBetTypeSelect.locator('option'),
      'Default Bet Type select should list all bet types in order',
    ).toHaveText([...AuthPage.EXPECTED_BET_TYPES]);
    await expect(authPage.defaultBetTypeSelect, 'Default Bet Type select should default to Player Prop').toHaveValue(
      AuthPage.DEFAULT_BET_TYPE,
    );

    await expect(authPage.defaultStakeInput, 'Default Stake input should default to 5').toHaveValue(
      AuthPage.DEFAULT_STAKE,
    );
  });

  test('Unchecking a bookmaker removes it from the Default Bookmaker options', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.togglePreferences();

    await authPage.toggleBookmaker('Betfair');

    await expect(authPage.bookmakerCheckbox('Betfair'), 'Betfair checkbox should become unchecked').not.toBeChecked();
    await expect(
      authPage.defaultBookmakerSelect.locator('option'),
      'Betfair should be removed from the Default Bookmaker options, leaving the rest in order',
    ).toHaveText(AuthPage.EXPECTED_BOOKMAKERS.filter((bookmaker) => bookmaker !== 'Betfair'));
  });

  test('The last remaining bookmaker checkbox cannot be unchecked', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.togglePreferences();

    const bookmakersExceptLast = AuthPage.EXPECTED_BOOKMAKERS.slice(0, -1);
    const lastBookmaker = AuthPage.EXPECTED_BOOKMAKERS[AuthPage.EXPECTED_BOOKMAKERS.length - 1];

    for (const bookmaker of bookmakersExceptLast) {
      await authPage.toggleBookmaker(bookmaker);
    }
    // The one remaining checked bookmaker's checkbox should now be disabled,
    // preventing any further attempt to uncheck it.

    await expect(authPage.bookmakerCheckbox(lastBookmaker), 'The last remaining bookmaker should stay checked').toBeChecked();
    await expect(
      authPage.bookmakerCheckbox(lastBookmaker),
      'The last remaining bookmaker checkbox should become disabled to prevent unchecking it',
    ).toBeDisabled();
    await expect(
      authPage.defaultBookmakerSelect.locator('option'),
      'Default Bookmaker select should only offer the one remaining bookmaker',
    ).toHaveText([lastBookmaker]);
  });
});

test.describe('Auth Signup - Password Visibility', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto('signup');
  });

  test('Password becomes visible after clicking the show/hide toggle, and hides again on a second click', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.fillPassword(VALID_PASSWORD);

    await expect(authPage.passwordInput, 'Password input should be type="password" by default').toHaveAttribute(
      'type',
      'password',
    );

    await authPage.togglePasswordVisibility();
    await expect(authPage.passwordInput, 'Password input should become type="text" after toggling').toHaveAttribute(
      'type',
      'text',
    );
    await expect(
      authPage.togglePasswordVisibilityButton,
      'Toggle button aria-label should read "Hide password" once revealed',
    ).toHaveAttribute('aria-label', 'Hide password');

    await authPage.togglePasswordVisibility();
    await expect(authPage.passwordInput, 'Password input should revert to type="password"').toHaveAttribute(
      'type',
      'password',
    );
    await expect(
      authPage.togglePasswordVisibilityButton,
      'Toggle button aria-label should revert to "Show password"',
    ).toHaveAttribute('aria-label', 'Show password');
  });
});
