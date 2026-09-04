import { Page, Locator, expect } from '@playwright/test';
import { BETS_COLUMN_KEYS, BETS_COLUMN_LABELS, BETS_SORTABLE_COLUMN_KEYS, BetsSortableColumnKey } from './bets-columns';

/**
 * Component object for the Bets page's desktop table (sortable headers,
 * rows) — split out of `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md.
 * Composed into `BetsPage` via `readonly table`.
 */
export class BetsTableComponent {
  readonly page: Page;

  readonly desktopTable: Locator;
  readonly tableHeaders: Record<string, Locator>;
  readonly sortButtons: Record<string, Locator>;
  readonly sortIndicators: Record<string, Locator>;
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.desktopTable = page.getByTestId('bets-table-desktop');
    this.tableHeaders = Object.fromEntries(
      BETS_COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-table-header-${key}`)]),
    );
    this.sortButtons = Object.fromEntries(
      BETS_SORTABLE_COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-table-sort-button-${key}`)]),
    );
    this.sortIndicators = Object.fromEntries(
      BETS_SORTABLE_COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-table-sort-indicator-${key}`)]),
    );
    this.tableRows = page.getByTestId('bets-table-row');
  }

  async toggleSort(key: BetsSortableColumnKey) {
    await this.sortButtons[key].click();
  }

  /** Cosmetic check for the desktop table headers, in their default (unsorted) state. */
  async expectCosmeticElements() {
    await expect(this.desktopTable, 'Desktop table should be visible').toBeVisible();
    for (const key of BETS_COLUMN_KEYS) {
      await expect(this.tableHeaders[key], `"${BETS_COLUMN_LABELS[key]}" header should be visible`).toBeVisible();
      await expect(
        this.tableHeaders[key],
        `"${BETS_COLUMN_LABELS[key]}" header should read "${BETS_COLUMN_LABELS[key]}"`,
      ).toContainText(BETS_COLUMN_LABELS[key]);
    }
    for (const key of BETS_SORTABLE_COLUMN_KEYS) {
      await expect(
        this.sortIndicators[key],
        `"${key}" sort indicator should default to "▲▼"`,
      ).toHaveText('▲▼');
    }
  }
}
