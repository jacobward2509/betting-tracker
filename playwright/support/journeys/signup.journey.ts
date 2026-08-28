import { Page } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';
import { waitForResponse } from '@functions/index';

export type SignupPreferences = {
  bookmakersToUncheck?: string[];
  defaultBetType?: string;
  defaultStake?: string;
};

export type SignupDetails = {
  name: string;
  email: string;
  password: string;
  preferences?: SignupPreferences;
};

/**
 * Orchestration only, no assertions (per the Journeys layer convention) —
 * navigates directly to `/sign-up` and submits the signup form (optionally
 * configuring Betting Preferences first). Callers assert the resulting
 * outcome (e.g. navigation to `/bets`, or a resulting error) in the spec
 * itself.
 *
 * Returns the bearer session token from the signup response (or undefined if
 * the signup did not succeed), so callers can clean up the created account
 * via DELETE /api/auth/me once the test is done with it.
 */
export async function signUp(
  page: Page,
  { name, email, password, preferences }: SignupDetails,
): Promise<string | undefined> {
  const authPage = new AuthPage(page);
  await authPage.goto('signup');


  if (preferences) {
    await authPage.togglePreferences();

    for (const bookmaker of preferences.bookmakersToUncheck ?? []) {
      await authPage.toggleBookmaker(bookmaker);
    }
    if (preferences.defaultBetType) {
      await authPage.selectDefaultBetType(preferences.defaultBetType);
    }
    if (preferences.defaultStake) {
      await authPage.fillDefaultStake(preferences.defaultStake);
    }
  }

  // Register the listener BEFORE submit() triggers the signup request, so the
  // response can't resolve before this listener attaches.
  const signupResponsePromise = waitForResponse(page, 'POST', '/api/auth/signup');
  await authPage.submitSignupForm({ name, email, password });
  const signupResponse = await signupResponsePromise;

  if (signupResponse.status() !== 201) return undefined;
  const body = await signupResponse.json();
  return body.token as string;
}
