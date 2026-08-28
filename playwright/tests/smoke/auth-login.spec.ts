import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

// This suite exercises the unauthenticated → authenticated login flow itself,
// so it must always start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Login Page', () => {
  test.beforeEach(async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('Cosmetic - page loads with heading and navigation buttons visible', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectLoaded('login');
  });

  test('Cosmetic - Heading renders with correct text for login mode', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectHeadingCosmeticElements();

    await expect(authPage.authHeading, 'Auth heading should read "Sign In"').toHaveText('Sign In');
    await expect(authPage.authSubtext, 'Auth subtext should read "Access your betting tracker."').toHaveText(
      'Access your betting tracker.',
    );
  });

  test('Cosmetic - Email field renders with correct label and default state', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectEmailFieldCosmeticElements();
  });

  test('Cosmetic - Password field renders with correct label and default state', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectPasswordFieldCosmeticElements();
  });

  test('Cosmetic - Submit button renders with correct text for login mode', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectSubmitButtonCosmeticElements();

    await expect(authPage.submitButton, 'Submit button should read "Sign In"').toHaveText('Sign In');
  });

  test('Cosmetic - Mode toggle button renders with correct text for login mode', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectToggleModeButtonCosmeticElements('Need an account? Sign up');
  });

  test('Cosmetic - Auth error message is hidden by default', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectAuthErrorMessageCosmeticElements();
  });

  test('Cosmetic - Signup-only elements are absent from the DOM in login mode', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.expectSignupOnlyElementsAbsentInLoginMode();
  });
});

