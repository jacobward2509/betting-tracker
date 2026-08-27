import { Page, Locator, expect } from '@playwright/test';

/**
 * Minimal Page Object for BetsView (`/bets`). Only exposes the landmark used
 * by `ui-test-plan-auth-signup.md` (Scenarios 15-16) to confirm a successful
 * signup navigated correctly — full coverage of this page belongs to its own
 * dedicated UI test plan, per that plan's Out of Scope section.
 */
export class BetsPage {
  readonly page: Page;

  readonly addBetButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.addBetButton = page.getByTestId('add-bet-button');
  }

  /** Lightweight smoke check: URL and one defining locator. */
  async expectLoaded() {
    await expect(this.page, 'Bets page URL should be /bets').toHaveURL(/\/bets/);
    await expect(this.addBetButton, '"Add Bet" button should be visible').toBeVisible();
  }
}
