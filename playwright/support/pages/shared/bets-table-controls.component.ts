import { Page, Locator, expect } from '@playwright/test';
import { BETS_COLUMN_KEYS, BETS_COLUMN_LABELS, BetsColumnKey } from './bets-columns';

/**
 * Component object for the Bets table controls bar (rows-per-page selector
 * and the Columns toggle/menu) — split out of `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md.
 * Composed into `BetsPage` via `readonly tableControls`.
 */
export class BetsTableControlsComponent {
  readonly page: Page;

  readonly rowsPerPageSelect: Locator;
  readonly columnsToggleButton: Locator;
  readonly columnsMenu: Locator;
  readonly columnCheckboxes: Record<string, Locator>;

  constructor(page: Page) {
    this.page = page;

    this.rowsPerPageSelect = page.getByTestId('bets-rows-per-page-select');
    this.columnsToggleButton = page.getByTestId('bets-columns-toggle-button');
    this.columnsMenu = page.getByTestId('bets-columns-menu');
    this.columnCheckboxes = Object.fromEntries(
      BETS_COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-columns-option-${key}`)]),
    );
  }

  async openColumnsMenu() {
    await this.columnsToggleButton.click();
  }

  async uncheckColumn(key: BetsColumnKey) {
    await this.columnCheckboxes[key].locator('input[type="checkbox"]').uncheck();
  }

  async selectRowsPerPage(size: number) {
    await this.rowsPerPageSelect.selectOption(String(size));
  }

  /** Cosmetic check for the table controls bar (rows-per-page + Columns button) in its default state. */
  async expectCosmeticElements() {
    await expect(this.rowsPerPageSelect, 'Rows-per-page selector should default to "10"').toHaveValue('10');
    await expect(
      this.rowsPerPageSelect.locator('option'),
      'Rows-per-page selector should offer 5/10/25/50/100 in order',
    ).toHaveText(['5', '10', '25', '50', '100']);

    await expect(this.columnsToggleButton, '"Columns" toggle button should be visible').toBeVisible();
    await expect(this.columnsToggleButton, '"Columns" toggle button should read "Columns"').toHaveText('Columns');
    await expect(this.columnsMenu, 'Columns menu should be absent by default').toHaveCount(0);
  }
}
