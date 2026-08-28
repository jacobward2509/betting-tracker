import { expect, test } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { logIn } from '@journeys/login.journey';
import { apiPost, deleteAccount } from '@functions/index';
import { maximumSignupBody } from '@seed-data/auth/signup';

test.describe('Login Journey', () => {
  test('User can log in with valid credentials and land on the Bets page', async ({ page, request }) => {
    // Seed a known-good, pre-existing account directly via the signup API
    // (rather than driving the signup UI) — this test's scope is exclusively
    // the login flow for a user who already has an account. Uses an absolute
    // URL against API_BASE_URL since the e2e project's baseURL is the web app.
    const signupBody = maximumSignupBody();
    const seedResponse = await apiPost(request, `${process.env.API_BASE_URL}/api/auth/signup`, {
      data: signupBody,
      noAuth: true,
    });
    expect(seedResponse.status(), 'Seed signup request should return 201').toBe(201);
    const { token } = await seedResponse.json();

    try {
      await logIn(page, { email: signupBody.email, password: signupBody.password });

      const betsPage = new BetsPage(page);
      await betsPage.expectLoaded();
    } finally {
      await deleteAccount(request, token);
    }
  });
});
