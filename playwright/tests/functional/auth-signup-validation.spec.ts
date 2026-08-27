import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';
import { randomSignupEmail } from '@seed-data/auth/signup';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Cline QA Test';

test.describe('Auth Signup - Field Validation', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.toggleMode();
  });

  test('Submitting with all required fields empty shows inline errors for each field, with no request sent', async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    let signupRequestFired = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/signup')) signupRequestFired = true;
    });

    await authPage.submit();

    await expect(authPage.nameError, 'Name error should read "Name is required."').toHaveText('Name is required.');
    await expect(authPage.emailError, 'Email error should read "Email is required."').toHaveText('Email is required.');
    await expect(authPage.passwordError, 'Password error should read "Password is required."').toHaveText(
      'Password is required.',
    );
    await expect(authPage.nameInput, 'Name input should be marked invalid').toHaveAttribute('aria-invalid', 'true');
    await expect(authPage.emailInput, 'Email input should be marked invalid').toHaveAttribute('aria-invalid', 'true');
    await expect(authPage.passwordInput, 'Password input should be marked invalid').toHaveAttribute('aria-invalid', 'true');
    expect(signupRequestFired, 'No signup request should be sent when required fields are empty').toBe(false);
  });

  test('A Name shorter than 2 characters shows a length error', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.submitSignupForm({ name: 'A', email: randomSignupEmail(), password: VALID_PASSWORD });

    await expect(authPage.nameError, 'Name error should read the minimum-length message').toHaveText(
      'Name must be at least 2 characters long.',
    );
  });

  test('A malformed Email shows a format error', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.submitSignupForm({ name: VALID_NAME, email: 'not-an-email', password: VALID_PASSWORD });

    await expect(authPage.emailError, 'Email error should read the format message').toHaveText(
      'Please provide a valid email address.',
    );
  });

  test('A Password shorter than the minimum length shows a length error', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.submitSignupForm({ name: VALID_NAME, email: randomSignupEmail(), password: 'short' });

    await expect(authPage.passwordError, 'Password error should read the minimum-length message').toHaveText(
      `Password must be at least ${AuthPage.SIGNUP_PASSWORD_MIN_LENGTH} characters long.`,
    );
  });

  test('A field error clears independently as soon as that field is edited', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.submit();

    await expect(authPage.nameError, 'Name error should be visible before editing').toBeVisible();
    await expect(authPage.emailError, 'Email error should be visible before editing').toBeVisible();

    // Only the Name field is edited — its error should clear while the others remain.
    await authPage.fillName('B');

    await expect(authPage.nameError, 'Name error should clear once the field is edited').toBeHidden();
    await expect(authPage.emailError, 'Email error should remain visible, unaffected by editing Name').toBeVisible();
    await expect(authPage.passwordError, 'Password error should remain visible, unaffected by editing Name').toBeVisible();
  });

  test('A Default Stake of zero blocks submission with a top-level error and no request sent', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.togglePreferences();
    await authPage.fillDefaultStake('0');

    let signupRequestFired = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/signup')) signupRequestFired = true;
    });

    await authPage.submitSignupForm({ name: VALID_NAME, email: randomSignupEmail(), password: VALID_PASSWORD });

    await expect(authPage.authErrorMessage, 'Auth error message should read the stake validation message').toHaveText(
      'Default stake must be a positive number.',
    );
    expect(signupRequestFired, 'No signup request should be sent when the default stake is not positive').toBe(false);
  });
});

test.describe('Auth Signup - Server-Side Error Surfacing', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.toggleMode();
  });

  test('Signing up with an email that already has an account shows a clean error message', async ({ page }) => {
    const authPage = new AuthPage(page);
    const email = randomSignupEmail();

    // Create the account once so the second attempt below is a genuine duplicate.
    await authPage.submitSignupForm({ name: VALID_NAME, email, password: VALID_PASSWORD });
    await expect(page, 'First signup should succeed and navigate to /bets').toHaveURL(/\/bets/);

    // Clear the session from the first signup so the guestOnly route guard doesn't
    // redirect straight back to /bets on the next /auth visit.
    await page.evaluate(() => localStorage.clear());
    await authPage.goto();
    await authPage.toggleMode();
    await authPage.submitSignupForm({ name: VALID_NAME, email, password: VALID_PASSWORD });

    await expect(
      authPage.authErrorMessage,
      'Auth error message should read the clean duplicate-account message',
    ).toHaveText('An account with this email already exists.');
  });

  test('A Name that fails only server-side validation surfaces the field error inline', async ({ page }) => {
    const authPage = new AuthPage(page);
    // 61 characters passes the client's minimum-length-only check but exceeds the
    // server's maxLength of 60, so this only fails once the request round-trips.
    const tooLongName = 'A'.repeat(61);

    await authPage.submitSignupForm({ name: tooLongName, email: randomSignupEmail(), password: VALID_PASSWORD });

    await expect(
      authPage.authErrorMessage,
      'Auth error message should read the generic field-correction message',
    ).toHaveText('Please correct the highlighted fields and try again.');
    await expect(authPage.nameError, 'Name error should surface the server-returned message').toHaveText(
      'Name must be at most 60 characters long.',
    );
  });
});


test.describe('Auth Signup - Submission State', () => {
  test('Submit button disables and shows "Please wait..." while the signup request is in flight', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.toggleMode();

    await authPage.fillName(VALID_NAME);
    await authPage.fillEmail(randomSignupEmail());
    await authPage.fillPassword(VALID_PASSWORD);

    // Delay the response so the transient "Please wait..." state is observable.
    await page.route('**/api/auth/signup', async (route) => {
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

test.describe('Auth Signup - Mode Toggle', () => {
  test('"Already have an account? Sign in" switches to login mode without changing the URL', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.toggleMode();

    await expect(authPage.authHeading, 'Heading should read "Create Account" before toggling').toHaveText(
      'Create Account',
    );

    await authPage.toggleMode();

    await expect(page, 'URL should remain /auth after toggling mode').toHaveURL(/\/auth/);
    await expect(authPage.authHeading, 'Heading should read "Sign In" after toggling back to login mode').toHaveText(
      'Sign In',
    );
    await expect(authPage.nameLabel, 'Name label should be hidden in login mode').toBeHidden();
    await expect(authPage.preferencesHeading, 'Preferences heading should be hidden in login mode').toBeHidden();
    await expect(authPage.passwordHelperText, 'Password helper text should be hidden in login mode').toBeHidden();
  });
});

