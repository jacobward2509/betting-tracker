import { test, expect } from '@playwright/test';
import { TopBannerPage } from '@pages/top-banner.page';
import { AuthPage } from '@pages/auth.page';
import { logIn } from '@journeys/login.journey';
import { apiPost, deleteAccount } from '@functions/index';
import { maximumSignupBody } from '@seed-data/auth/signup';

// This journey exercises the authenticated → unauthenticated sign-out flow
// itself, so it must always start logged out regardless of the project's
// default storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Sign Out Journey', () => {
  let token: string | undefined;

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Signing out from the user menu navigates to the sign-in page', async ({ page, request }) => {
    // Seed a known-good, pre-existing account directly via the signup API
    // (rather than driving the signup UI) — this test's scope is exclusively
    // the sign-out flow for an already-authenticated user. Uses an absolute
    // URL against API_BASE_URL since the e2e project's baseURL is the web app.
    const signupBody = maximumSignupBody();
    const seedResponse = await apiPost(request, `${process.env.API_BASE_URL}/api/auth/signup`, {
      data: signupBody,
      noAuth: true,
    });
    expect(seedResponse.status(), 'Seed signup request should return 201').toBe(201);
    ({ token } = await seedResponse.json());

    await logIn(page, { email: signupBody.email, password: signupBody.password });

    const topBannerPage = new TopBannerPage(page);
    await topBannerPage.openUserMenu();
    await topBannerPage.signOut();

    const authPage = new AuthPage(page);
    await authPage.expectLoaded('login');
  });
});
