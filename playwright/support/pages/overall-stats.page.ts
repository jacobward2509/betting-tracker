import { Page, Locator, expect } from '@playwright/test';

/**
 * Minimal Page Object for OverallStatsView (`/overall-stats`). Only exposes
 * the landmark used by `ui-test-plan-tab-nav.md` (Scenario 2) to confirm a
 * tab-nav click navigated correctly — full coverage of this page belongs to
 * its own dedicated UI test plan, not yet written.
 */
export class OverallStatsPage {
  readonly page: Page;

  readonly overallHeading: Locator;

  constructor(page: Page) {
    this.page = page;

    this.overallHeading = page.getByRole('heading', { name: 'Overall' });
  }

  /** Lightweight smoke check: URL and one defining locator. */
  async expectLoaded() {
    await expect(this.page, 'Overall Stats page URL should be /overall-stats').toHaveURL(/\/overall-stats/);
    await expect(this.overallHeading, '"Overall" section heading should be visible').toBeVisible();
  }
}
