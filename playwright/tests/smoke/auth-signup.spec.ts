import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

test.describe('Auth Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.toggleMode();
  });

  test('Cosmetic - signup form renders with correct heading, labels, and default field states', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectLoaded();

    await expect(authPage.authHeading, 'Auth heading should be visible').toBeVisible();
    await expect(authPage.authHeading, 'Auth heading should read "Create Account"').toHaveText('Create Account');
    await expect(authPage.authSubtext, 'Auth subtext should read "Start tracking your bets."').toHaveText(
      'Start tracking your bets.',
    );

    await expect(authPage.nameLabel, 'Name label should be visible').toBeVisible();
    await expect(authPage.nameLabel, 'Name label should read "Name"').toHaveText('Name');
    await expect(authPage.nameInput, 'Name input should be empty by default').toBeEmpty();
    await expect(authPage.nameError, 'Name error should be hidden by default').toBeHidden();

    await expect(authPage.emailLabel, 'Email label should read "Email"').toHaveText('Email');
    await expect(authPage.emailInput, 'Email input should be empty by default').toBeEmpty();
    await expect(authPage.emailError, 'Email error should be hidden by default').toBeHidden();

    await expect(authPage.passwordLabel, 'Password label should read "Password"').toHaveText('Password');
    await expect(authPage.passwordInput, 'Password input should be empty by default').toBeEmpty();
    await expect(authPage.passwordError, 'Password error should be hidden by default').toBeHidden();
    await expect(
      authPage.passwordHelperText,
      `Password helper text should read "Minimum ${AuthPage.SIGNUP_PASSWORD_MIN_LENGTH} characters."`,
    ).toHaveText(`Minimum ${AuthPage.SIGNUP_PASSWORD_MIN_LENGTH} characters.`);

    await expect(authPage.submitButton, 'Submit button should be visible').toBeVisible();
    await expect(authPage.submitButton, 'Submit button should read "Create Account"').toHaveText('Create Account');
    await expect(authPage.submitButton, 'Submit button should be enabled').toBeEnabled();

    await expect(authPage.authErrorMessage, 'Auth error message should be hidden by default').toBeHidden();
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
