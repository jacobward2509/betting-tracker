import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for BetsView (`/bets`). Originally minimal (exposing only the
 * `addBetButton` landmark used by `ui-test-plan-auth-signup.md` to confirm
 * signup navigation) — now extended to cover the summary stats bar and the
 * `BetsTableControls.vue` filter panel, per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md.
 * The bets table itself, row selection/bulk actions, and Add/Edit Bet remain
 * out of scope — see that plan's "Out of Scope" section for the future plans
 * that will extend this page object further.
 */
export class BetsPage {
  readonly page: Page;

  readonly addBetButton: Locator;

  // Summary stats bar
  readonly totalCount: Locator;
  readonly totalCountValue: Locator;
  readonly favouriteBookie: Locator;
  readonly favouriteBookieValue: Locator;
  readonly totalProfitLoss: Locator;
  readonly totalProfitLossValue: Locator;

  // Filters panel (BetsTableControls.vue)
  readonly filtersToggleButton: Locator;
  readonly filtersActiveBadge: Locator;
  readonly filtersClearButton: Locator;
  readonly filtersPanelBody: Locator;
  readonly seasonSelect: Locator;
  readonly fixtureInput: Locator;
  readonly dateInput: Locator;
  readonly bookieSelect: Locator;
  readonly stakeTypeSelect: Locator;
  readonly resultSelect: Locator;

  constructor(page: Page) {
    this.page = page;

    this.addBetButton = page.getByTestId('add-bet-button');

    this.totalCount = page.getByTestId('bets-total-count');
    this.totalCountValue = page.getByTestId('bets-total-count-value');
    this.favouriteBookie = page.getByTestId('bets-favourite-bookie');
    this.favouriteBookieValue = page.getByTestId('bets-favourite-bookie-value');
    this.totalProfitLoss = page.getByTestId('bets-total-profit-loss');
    this.totalProfitLossValue = page.getByTestId('bets-total-profit-loss-value');

    this.filtersToggleButton = page.getByTestId('bets-filters-toggle-button');
    this.filtersActiveBadge = page.getByTestId('bets-filters-active-badge');
    this.filtersClearButton = page.getByTestId('bets-filters-clear-button');
    this.filtersPanelBody = page.getByTestId('bets-filters-panel-body');
    this.seasonSelect = page.getByTestId('bets-filter-season-select');
    this.fixtureInput = page.getByTestId('bets-filter-fixture-input');
    this.dateInput = page.getByTestId('bets-filter-date-input');
    this.bookieSelect = page.getByTestId('bets-filter-bookie-select');
    this.stakeTypeSelect = page.getByTestId('bets-filter-stake-type-select');
    this.resultSelect = page.getByTestId('bets-filter-result-select');
  }

  /** Lightweight smoke check: URL and one defining locator. */
  async expectLoaded() {
    await expect(this.page, 'Bets page URL should be /bets').toHaveURL(/\/bets/);
    await expect(this.addBetButton, '"Add Bet" button should be visible').toBeVisible();
  }

  async toggleFilters() {
    await this.filtersToggleButton.click();
  }

  async clearFilters() {
    await this.filtersClearButton.click();
  }

  async selectBookie(bookmaker: string) {
    await this.bookieSelect.selectOption(bookmaker);
  }

  /** Cosmetic check for the summary stats bar component only. */
  async expectSummaryStatsCosmeticElements(expected: {
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

  /** Cosmetic check for the filters panel collapsed by default (no active filters). */
  async expectFiltersCollapsedCosmeticElements() {
    await expect(this.filtersToggleButton, 'Filters toggle button should be visible').toBeVisible();
    await expect(this.filtersToggleButton, 'Filters toggle button should read "▶Filters"').toHaveText(
      '▶Filters',
    );
    await expect(this.filtersActiveBadge, 'Active-filter badge should be absent by default').toHaveCount(0);
    await expect(this.filtersClearButton, 'Clear button should be absent by default').toHaveCount(0);
    await expect(this.filtersPanelBody, 'Filter panel body should be absent from the DOM by default').toHaveCount(0);
  }

  async expectFiltersPanelHidden() {
    await expect(this.filtersPanelBody, 'Filter panel body should be absent from the DOM').toHaveCount(0);
  }

  async expectFiltersPanelVisible() {
    await expect(this.filtersPanelBody, 'Filter panel body should be visible').toBeVisible();
    await expect(this.filtersToggleButton, 'Filters toggle button should read "▼Filters"').toHaveText(
      '▼Filters',
    );
    for (const locator of [
      this.seasonSelect,
      this.fixtureInput,
      this.dateInput,
      this.bookieSelect,
      this.stakeTypeSelect,
      this.resultSelect,
    ]) {
      await expect(locator, 'Filter control should be visible').toBeVisible();
    }
  }

  async expectActiveFilterBadge(count: number) {
    await expect(this.filtersActiveBadge, `Active-filter badge should show "${count} active"`).toHaveText(
      `${count} active`,
    );
    await expect(this.filtersClearButton, 'Clear button should be visible').toBeVisible();
  }

  async expectNoActiveFilterBadge() {
    await expect(this.filtersActiveBadge, 'Active-filter badge should be absent').toHaveCount(0);
    await expect(this.filtersClearButton, 'Clear button should be absent').toHaveCount(0);
  }
}


