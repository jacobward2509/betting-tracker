import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';
import { FixturesBannerPage } from '@pages/fixtures-banner.page';

// The banner is rendered on the logged-out sign-in/sign-up pages, so this
// test must start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Fixtures Banner - Resilience', () => {
  test('Functional - Banner degrades gracefully when the fixtures request fails', async ({ page }) => {
    const bannerPage = new FixturesBannerPage(page);
    await bannerPage.mockFixturesFailure(500);

    const authPage = new AuthPage(page);
    await authPage.goto('login');

    await bannerPage.expectAbsent();

    // The banner's own request failure must not surface any error to the
    // user or otherwise affect the sign-in form.
    await expect(authPage.authErrorMessage, 'Auth error message should not be shown due to the banner failing').toBeHidden();
    await expect(authPage.emailInput, 'Email input should remain visible and usable').toBeVisible();
    await expect(authPage.passwordInput, 'Password input should remain visible and usable').toBeVisible();
    await expect(authPage.submitButton, 'Submit button should remain visible').toBeVisible();
    await expect(authPage.submitButton, 'Submit button should remain enabled').toBeEnabled();
  });
});
