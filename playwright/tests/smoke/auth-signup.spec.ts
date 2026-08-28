import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

// This suite exercises the unauthenticated → authenticated signup flow
// itself, so it must always start logged out regardless of the project's
// default storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.toggleMode();
  });

  test('Cosmetic - page loads with heading and preferences section visible', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectLoaded();
  });

  test('Cosmetic - Heading renders with correct text for signup mode', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectHeadingCosmeticElements();

    await expect(authPage.authHeading, 'Auth heading should read "Create Account"').toHaveText('Create Account');
    await expect(authPage.authSubtext, 'Auth subtext should read "Start tracking your bets."').toHaveText(
      'Start tracking your bets.',
    );
  });

  test('Cosmetic - Name field renders with correct label and default state', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectNameFieldCosmeticElements();
  });

  test('Cosmetic - Email field renders with correct label and default state', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectEmailFieldCosmeticElements();
  });

  test('Cosmetic - Password field renders with correct label, helper text, and default state for signup mode', async ({
    page,
  }) => {
    const authPage = new AuthPage(page);
    await authPage.expectPasswordFieldCosmeticElements();

    await expect(
      authPage.passwordHelperText,
      `Password helper text should read "Minimum ${AuthPage.SIGNUP_PASSWORD_MIN_LENGTH} characters."`,
    ).toHaveText(`Minimum ${AuthPage.SIGNUP_PASSWORD_MIN_LENGTH} characters.`);
  });

  test('Cosmetic - Submit button renders with correct text for signup mode', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectSubmitButtonCosmeticElements();

    await expect(authPage.submitButton, 'Submit button should read "Create Account"').toHaveText('Create Account');
  });

  test('Cosmetic - Auth error message is hidden by default', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectAuthErrorMessageCosmeticElements();
  });

  test('Cosmetic - Betting Preferences section renders collapsed with its footer note visible', async ({ page }) => {
    const authPage = new AuthPage(page);

    await expect(authPage.preferencesHeading, 'Preferences heading should read "Betting Preferences (Optional)"').toHaveText(
      'Betting Preferences (Optional)',
    );
    await expect(
      authPage.preferencesHelperText,
      'Preferences helper text should read "Configure defaults now, or skip and use platform defaults."',
    ).toHaveText('Configure defaults now, or skip and use platform defaults.');
    await expect(authPage.togglePreferencesButton, 'Toggle preferences button should read "Configure"').toHaveText(
      'Configure',
    );
    await expect(
      authPage.preferencesFooterNote,
      'Preferences footer note should be visible',
    ).toBeVisible();

    for (const bookmaker of AuthPage.EXPECTED_BOOKMAKERS) {
      await expect(
        authPage.bookmakerCheckbox(bookmaker),
        `"${bookmaker}" checkbox should be hidden until Configure is clicked`,
      ).toBeHidden();
    }
    await expect(authPage.defaultBookmakerSelect, 'Default Bookmaker select should be hidden until Configure is clicked').toBeHidden();
    await expect(authPage.defaultBetTypeSelect, 'Default Bet Type select should be hidden until Configure is clicked').toBeHidden();
    await expect(authPage.defaultStakeInput, 'Default Stake input should be hidden until Configure is clicked').toBeHidden();
  });
});
