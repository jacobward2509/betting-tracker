import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

test.describe('Auth Login Page', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('Cosmetic - login form renders with correct heading, labels, and default field states', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectLoaded();

    await expect(authPage.authHeading, 'Auth heading should be visible').toBeVisible();
    await expect(authPage.authHeading, 'Auth heading should read "Sign In"').toHaveText('Sign In');
    await expect(authPage.authSubtext, 'Auth subtext should read "Access your betting tracker."').toHaveText(
      'Access your betting tracker.',
    );

    await expect(authPage.emailLabel, 'Email label should read "Email"').toHaveText('Email');
    await expect(authPage.emailInput, 'Email input should be empty by default').toBeEmpty();
    await expect(authPage.emailInput, 'Email input should have no placeholder attribute').not.toHaveAttribute(
      'placeholder',
    );
    await expect(authPage.emailError, 'Email error should be hidden by default').toBeHidden();

    await expect(authPage.passwordLabel, 'Password label should read "Password"').toHaveText('Password');
    await expect(authPage.passwordInput, 'Password input should be empty by default').toBeEmpty();
    await expect(authPage.passwordInput, 'Password input should have no placeholder attribute').not.toHaveAttribute(
      'placeholder',
    );
    await expect(authPage.passwordError, 'Password error should be hidden by default').toBeHidden();

    await expect(authPage.submitButton, 'Submit button should be visible').toBeVisible();
    await expect(authPage.submitButton, 'Submit button should read "Sign In"').toHaveText('Sign In');
    await expect(authPage.submitButton, 'Submit button should be enabled').toBeEnabled();

    await expect(authPage.toggleModeButton, 'Mode toggle button should be visible').toBeVisible();
    await expect(
      authPage.toggleModeButton,
      'Mode toggle button should read "Need an account? Sign up"',
    ).toHaveText('Need an account? Sign up');

    await expect(authPage.authErrorMessage, 'Auth error message should be hidden by default').toBeHidden();

    await expect(authPage.nameInput, 'Name input should not be present in the DOM in login mode').toHaveCount(0);
    await expect(
      authPage.preferencesHeading,
      'Betting Preferences heading should not be present in the DOM in login mode',
    ).toHaveCount(0);
    await expect(
      authPage.passwordHelperText,
      'Password helper text should not be present in the DOM in login mode',
    ).toHaveCount(0);
  });
});
