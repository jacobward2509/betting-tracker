import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Cline QA Test';

test.describe('Auth Login - Invalid Credentials', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('An unknown email shows a generic "Invalid email or password." error', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.submitLoginForm({ email: randomSignupEmail(), password: VALID_PASSWORD });

    await expect(
      authPage.authErrorMessage,
      'Auth error message should read the generic invalid-credentials message',
    ).toHaveText('Invalid email or password.');
    await expect(authPage.submitButton, 'Submit button should re-enable after the failed request').toBeEnabled();
    await expect(authPage.submitButton, 'Submit button text should revert to "Sign In"').toHaveText('Sign In');
  });

  test('A registered email with the wrong password shows the exact same error as an unknown email', async ({
    page,
    request,
  }) => {
    const email = randomSignupEmail();

    // Seed a known-good account via the signup journey, then sign back out so
    // the guestOnly route guard doesn't redirect straight back to /bets.
    const token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
    await page.evaluate(() => localStorage.clear());

    try {
      const authPage = new AuthPage(page);
      await authPage.goto();
      await authPage.submitLoginForm({ email, password: 'a-completely-wrong-password' });

      await expect(
        authPage.authErrorMessage,
        'Auth error message for wrong password should read the same generic message as an unknown email',
      ).toHaveText('Invalid email or password.');
    } finally {
      if (token) await deleteAccount(request, token);
    }
  });
});

test.describe('Auth Login - Submission State', () => {
  test('Submit button disables and shows "Please wait..." while the login request is in flight', async ({
    page,
  }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();

    await authPage.fillEmail(randomSignupEmail());
    await authPage.fillPassword(VALID_PASSWORD);

    // Delay the response so the transient "Please wait..." state is observable.
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await authPage.submit();

    await expect(authPage.submitButton, 'Submit button should show "Please wait..." while submitting').toHaveText(
      'Please wait...',
    );
    await expect(authPage.submitButton, 'Submit button should be disabled while submitting').toBeDisabled();
  });
});

test.describe('Auth Login - Password Visibility', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('Password becomes visible after clicking the show/hide toggle, and hides again on a second click', async ({
    page,
  }) => {
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
