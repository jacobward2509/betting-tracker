import { Page, Locator, expect } from '@playwright/test';

/**
 * Component object for the Bets page's filters panel (`BetsTableControls.vue`)
 * — split out of `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md.
 * Composed into `BetsPage` via `readonly filters`.
 */
export class BetsFiltersComponent {
  readonly page: Page;

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

  async toggleFilters() {
    await this.filtersToggleButton.click();
  }

  async clearFilters() {
    await this.filtersClearButton.click();
  }

  async selectBookie(bookmaker: string) {
    await this.bookieSelect.selectOption(bookmaker);
  }

  /** Cosmetic check for the filters panel collapsed by default (no active filters). */
  async expectCollapsedCosmeticElements() {
    await expect(this.filtersToggleButton, 'Filters toggle button should be visible').toBeVisible();
    await expect(this.filtersToggleButton, 'Filters toggle button should read "▶Filters"').toHaveText(
      '▶Filters',
    );
    await expect(this.filtersActiveBadge, 'Active-filter badge should be absent by default').toHaveCount(0);
    await expect(this.filtersClearButton, 'Clear button should be absent by default').toHaveCount(0);
    await expect(this.filtersPanelBody, 'Filter panel body should be absent from the DOM by default').toHaveCount(0);
  }

  async expectPanelHidden() {
    await expect(this.filtersPanelBody, 'Filter panel body should be absent from the DOM').toHaveCount(0);
  }

  async expectPanelVisible() {
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
