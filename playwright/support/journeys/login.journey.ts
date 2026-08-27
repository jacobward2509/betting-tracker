import { Page } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

export type LoginDetails = {
  email: string;
  password: string;
};

/**
 * Orchestration only, no assertions (per the Journeys layer convention) —
 * navigates to `/auth` (default login mode) and submits the login form.
 * Callers assert the resulting outcome (e.g. navigation to `/bets`, or a
 * resulting error) in the spec itself.
 */
export async function logIn(page: Page, { email, password }: LoginDetails) {
  const authPage = new AuthPage(page);
  await authPage.goto();
  await authPage.fillEmail(email);
  await authPage.fillPassword(password);
  await authPage.submit();
}
