import { Page } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';

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
 * navigates to `/auth`, switches to signup mode, optionally configures
 * Betting Preferences, and submits. Callers assert the resulting outcome
 * (e.g. navigation to `/bets`, or a resulting error) in the spec itself.
 */
export async function signUp(page: Page, { name, email, password, preferences }: SignupDetails) {
  const authPage = new AuthPage(page);
  await authPage.goto();
  await authPage.toggleMode();

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

  await authPage.submitSignupForm({ name, email, password });
}
