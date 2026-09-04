import { Page, Locator, expect } from '@playwright/test';

/**
 * Component object for the Bets page's summary stats bar (Total Bets /
 * Favourite Bookie / Total P/L) — split out of `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md.
 * Composed into `BetsPage` via `readonly summaryStats`.
 */
export class BetsSummaryStatsComponent {
  readonly page: Page;

  readonly totalCount: Locator;
  readonly totalCountValue: Locator;
  readonly favouriteBookie: Locator;
  readonly favouriteBookieValue: Locator;
  readonly totalProfitLoss: Locator;
  readonly totalProfitLossValue: Locator;

  constructor(page: Page) {
    this.page = page;

    this.totalCount = page.getByTestId('bets-total-count');
    this.totalCountValue = page.getByTestId('bets-total-count-value');
    this.favouriteBookie = page.getByTestId('bets-favourite-bookie');
    this.favouriteBookieValue = page.getByTestId('bets-favourite-bookie-value');
    this.totalProfitLoss = page.getByTestId('bets-total-profit-loss');
    this.totalProfitLossValue = page.getByTestId('bets-total-profit-loss-value');
  }

  /** Cosmetic check for the summary stats bar component only. */
  async expectCosmeticElements(expected: {
    totalBets: string;
    favouriteBookie: string;
    totalProfitLossText: string;
    totalProfitLossClass: string;
  }) {
    await expect(this.totalCount, 'Total Bets container should be visible').toBeVisible();
    await expect(this.totalCountValue, `Total Bets value should read "${expected.totalBets}"`).toHaveText(
      expected.totalBets,
    );
    await expect(this.favouriteBookie, 'Favourite Bookie container should be visible').toBeVisible();
    await expect(
      this.favouriteBookieValue,
      `Favourite Bookie value should read "${expected.favouriteBookie}"`,
    ).toHaveText(expected.favouriteBookie);
    await expect(this.totalProfitLoss, 'Total P/L container should be visible').toBeVisible();
    await expect(
      this.totalProfitLossValue,
      `Total P/L value should read "${expected.totalProfitLossText}"`,
    ).toHaveText(expected.totalProfitLossText);
    await expect(
      this.totalProfitLossValue,
      `Total P/L value should carry the "${expected.totalProfitLossClass}" class`,
    ).toHaveClass(new RegExp(expected.totalProfitLossClass));
  }
}
