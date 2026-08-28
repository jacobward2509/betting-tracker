import { test as setup } from '@playwright/test';
import path from 'path';
import { apiPost } from '@functions/index';
import { maximumSignupBody } from '@seed-data/auth/signup';
import { logIn } from '@journeys/login.journey';
import { BetsPage } from '@pages/bets.page';

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');

/**
 * Runs once before the `smoke`/`functional`/`e2e` UI projects. Seeds a
 * dedicated setup account directly via the signup API (not through the UI —
 * consistent with the seeding pattern in playwright-ui-test-generation.md
 * §8a), then logs in for real through the UI with those credentials so the
 * saved storage state reflects a genuine browser-driven session. Every
 * dependent project then starts already authenticated, reusing this file via
 * `use.storageState`.
 *
 * NOTE: this seeded account is never cleaned up here — a dedicated
 * account-cleanup mechanism for setup-seeded accounts is a known follow-up
 * (see the UI test generation guide's Data Seeding section).
 */
setup('authenticate', async ({ page, request }) => {
  const signupBody = maximumSignupBody();

  // Seed via the API directly rather than driving the signup UI — this setup
  // step only needs a valid account to log in with, not to exercise signup.
  await apiPost(request, `${process.env.API_BASE_URL}/api/auth/signup`, {
    data: signupBody,
    noAuth: true,
  });

  await logIn(page, { email: signupBody.email, password: signupBody.password });

  const betsPage = new BetsPage(page);
  await betsPage.expectLoaded();

  await page.context().storageState({ path: authFile });
});
