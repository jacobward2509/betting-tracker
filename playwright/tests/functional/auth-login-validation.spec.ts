import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

const VALID_PASSWORD = 'a-valid-password-123';


test.describe('Auth Login - Field Validation', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('Submitting with Email and Password both empty shows inline errors for each field, with no request sent', async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    let loginRequestFired = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login')) loginRequestFired = true;
    });

    await authPage.submit();

    await expect(authPage.emailError, 'Email error should read "Email is required."').toHaveText(
      'Email is required.',
    );
    await expect(authPage.passwordError, 'Password error should read "Password is required."').toHaveText(
      'Password is required.',
    );
    await expect(authPage.emailInput, 'Email input should be marked invalid').toHaveAttribute('aria-invalid', 'true');
    await expect(authPage.passwordInput, 'Password input should be marked invalid').toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(loginRequestFired, 'No login request should be sent when required fields are empty').toBe(false);
  });

  test('A malformed Email shows a format error and Password error stays hidden', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.submitLoginForm({ email: 'not-an-email', password: VALID_PASSWORD });

    await expect(authPage.emailError, 'Email error should read the format message').toHaveText(
      'Please provide a valid email address.',
    );
    await expect(authPage.passwordError, 'Password error should remain hidden').toBeHidden();
  });

  test('A field error clears independently as soon as that field is edited', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.submit();

    await expect(authPage.emailError, 'Email error should be visible before editing').toBeVisible();
    await expect(authPage.passwordError, 'Password error should be visible before editing').toBeVisible();

    // Only the Email field is edited — its error should clear while the Password error remains.
    await authPage.fillEmail('a');

    await expect(authPage.emailError, 'Email error should clear once the field is edited').toBeHidden();
    await expect(authPage.emailInput, 'Email input aria-invalid should be removed after editing').not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(authPage.passwordError, 'Password error should remain visible and unaffected').toBeVisible();
  });
});
