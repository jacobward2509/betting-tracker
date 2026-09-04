import { Page, Locator, expect } from '@playwright/test';

/**
 * Component object for the Bets page's mobile card view — split out of
 * `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md.
 * Composed into `BetsPage` via `readonly mobileCards`.
 */
export class BetsMobileCardsComponent {
  readonly page: Page;

  readonly mobileCardContainer: Locator;
  readonly mobileCards: Locator;
  readonly desktopTable: Locator;

  constructor(page: Page) {
    this.page = page;

    this.mobileCardContainer = page.getByTestId('bets-table-mobile');
    this.mobileCards = page.getByTestId('bets-table-mobile-card');
    // Referenced only to assert it's hidden below the md breakpoint —
    // `BetsTableComponent` owns the desktop table's own cosmetic checks.
    this.desktopTable = page.getByTestId('bets-table-desktop');
  }

  /** Cosmetic check for the mobile card view being visible and the desktop table being hidden below the `md` breakpoint. */
  async expectCosmeticElements(expectedCardCount: number) {
    await expect(this.mobileCardContainer, 'Mobile card container should be visible').toBeVisible();
    await expect(this.mobileCards, 'Expected number of mobile cards should be rendered').toHaveCount(
      expectedCardCount,
    );
    await expect(this.desktopTable, 'Desktop table should be hidden below the md breakpoint').toBeHidden();
  }
}
