import { Page, Locator, expect } from '@playwright/test';
import { waitForResponse } from '@functions/index';

/**
 * Page Object for BetsView (`/bets`). Originally minimal (exposing only the
 * `addBetButton` landmark used by `ui-test-plan-auth-signup.md` to confirm
 * signup navigation) — extended to cover the summary stats bar and the
 * `BetsTableControls.vue` filter panel per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md,
 * further extended to cover the bets table controls bar, desktop
 * table (sortable headers, rows), pagination controls, and mobile card view
 * per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md,
 * and now further extended to cover row selection/bulk actions (per-row and
 * select-all checkboxes, the desktop/mobile bulk result-update bars and
 * their inline error messages, per-row "Edit"/"Delete" buttons, and the
 * Delete confirmation modal and its inline error message) per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-row-selection-bulk-actions.md.
 * Add/Edit Bet remain out of scope — see that plan's "Out of Scope" section
 * for the future plans that will extend this page object further.
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

  // Table controls bar
  readonly rowsPerPageSelect: Locator;
  readonly columnsToggleButton: Locator;
  readonly columnsMenu: Locator;
  readonly columnCheckboxes: Record<string, Locator>;

  // Desktop table
  readonly desktopTable: Locator;
  readonly tableHeaders: Record<string, Locator>;
  readonly sortButtons: Record<string, Locator>;
  readonly sortIndicators: Record<string, Locator>;
  readonly tableRows: Locator;

  // Pagination controls
  readonly pagination: Locator;
  readonly paginationFirstButton: Locator;
  readonly paginationPreviousButton: Locator;
  readonly paginationPageInfo: Locator;
  readonly paginationNextButton: Locator;
  readonly paginationLastButton: Locator;

  // Mobile card view
  readonly mobileCardContainer: Locator;
  readonly mobileCards: Locator;

  // Row selection & bulk actions (desktop)
  readonly selectAllCheckboxHeader: Locator;
  readonly selectAllCheckbox: Locator;
  readonly actionsHeader: Locator;
  readonly rowCheckboxes: Locator;
  readonly rowEditButtons: Locator;
  readonly rowDeleteButtons: Locator;
  readonly bulkBarDesktop: Locator;
  readonly bulkSelectedCountDesktop: Locator;
  readonly bulkResultSelectDesktop: Locator;
  readonly bulkCashOutInputDesktop: Locator;
  readonly bulkApplyButtonDesktop: Locator;
  readonly bulkClearButtonDesktop: Locator;
  readonly bulkErrorDesktop: Locator;

  // Row selection & bulk actions (mobile card view)
  readonly mobileCardCheckboxes: Locator;
  readonly mobileCardEditButtons: Locator;
  readonly mobileCardDeleteButtons: Locator;
  readonly bulkBarMobile: Locator;
  readonly bulkSelectedCountMobile: Locator;
  readonly bulkResultSelectMobile: Locator;
  readonly bulkCashOutInputMobile: Locator;
  readonly bulkApplyButtonMobile: Locator;
  readonly bulkClearButtonMobile: Locator;
  readonly bulkErrorMobile: Locator;

  // Delete confirmation modal
  readonly deleteModal: Locator;
  readonly deleteModalCloseButton: Locator;
  readonly deleteModalFixture: Locator;
  readonly deleteModalDescription: Locator;
  readonly deleteModalError: Locator;
  readonly deleteModalCancelButton: Locator;
  readonly deleteModalConfirmButton: Locator;

  // Fetch error banner
  readonly fetchError: Locator;

  static readonly COLUMN_KEYS = [
    'date',
    'fixture',
    'bookie',
    'description',
    'stakeType',
    'stake',
    'odds',
    'result',
    'profitLoss',
  ] as const;

  static readonly SORTABLE_COLUMN_KEYS = ['date', 'stake', 'odds', 'result', 'profit'] as const;

  /**
   * Wraps a navigation/reload action (`page.goto('/bets')` or
   * `page.reload()`) and waits for the resulting `GET /api/bets` response to
   * complete before resolving — guards against interacting with selection
   * controls (e.g. select-all) before `paginatedBets` has populated, which
   * otherwise silently no-ops in `BetsView.vue`'s `toggleSelectPage()` and
   * leaves the native checkbox DOM state out of sync with the app's actual
   * selection state. Must be used any time a test navigates to/reloads
   * `/bets` before interacting with row/select-all checkboxes or the bulk
   * actions bar.
   */
  static async expectBetsLoaded(page: Page, action: () => Promise<unknown>): Promise<void> {
    const betsResponsePromise = waitForResponse(page, 'GET', '/api/bets');
    await action();
    await betsResponsePromise;
  }

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

    this.rowsPerPageSelect = page.getByTestId('bets-rows-per-page-select');
    this.columnsToggleButton = page.getByTestId('bets-columns-toggle-button');
    this.columnsMenu = page.getByTestId('bets-columns-menu');
    this.columnCheckboxes = Object.fromEntries(
      BetsPage.COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-columns-option-${key}`)]),
    );

    this.desktopTable = page.getByTestId('bets-table-desktop');
    this.tableHeaders = Object.fromEntries(
      BetsPage.COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-table-header-${key}`)]),
    );
    this.sortButtons = Object.fromEntries(
      BetsPage.SORTABLE_COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-table-sort-button-${key}`)]),
    );
    this.sortIndicators = Object.fromEntries(
      BetsPage.SORTABLE_COLUMN_KEYS.map((key) => [key, page.getByTestId(`bets-table-sort-indicator-${key}`)]),
    );
    this.tableRows = page.getByTestId('bets-table-row');

    this.pagination = page.getByTestId('bets-pagination');
    this.paginationFirstButton = page.getByTestId('bets-pagination-first-button');
    this.paginationPreviousButton = page.getByTestId('bets-pagination-previous-button');
    this.paginationPageInfo = page.getByTestId('bets-pagination-page-info');
    this.paginationNextButton = page.getByTestId('bets-pagination-next-button');
    this.paginationLastButton = page.getByTestId('bets-pagination-last-button');

    this.mobileCardContainer = page.getByTestId('bets-table-mobile');
    this.mobileCards = page.getByTestId('bets-table-mobile-card');

    this.selectAllCheckboxHeader = page.getByTestId('bets-table-header-select-all');
    this.selectAllCheckbox = page.getByTestId('bets-table-select-all-checkbox');
    this.actionsHeader = page.getByTestId('bets-table-header-actions');
    this.rowCheckboxes = page.getByTestId('bets-table-row-checkbox');
    this.rowEditButtons = page.getByTestId('bets-table-row-edit-button');
    this.rowDeleteButtons = page.getByTestId('bets-table-row-delete-button');
    this.bulkBarDesktop = page.getByTestId('bets-bulk-bar-desktop');
    this.bulkSelectedCountDesktop = page.getByTestId('bets-bulk-selected-count-desktop');
    this.bulkResultSelectDesktop = page.getByTestId('bets-bulk-result-select-desktop');
    this.bulkCashOutInputDesktop = page.getByTestId('bets-bulk-cash-out-input-desktop');
    this.bulkApplyButtonDesktop = page.getByTestId('bets-bulk-apply-button-desktop');
    this.bulkClearButtonDesktop = page.getByTestId('bets-bulk-clear-button-desktop');
    this.bulkErrorDesktop = page.getByTestId('bets-bulk-error-desktop');

    this.mobileCardCheckboxes = page.getByTestId('bets-table-mobile-card-checkbox');
    this.mobileCardEditButtons = page.getByTestId('bets-table-mobile-card-edit-button');
    this.mobileCardDeleteButtons = page.getByTestId('bets-table-mobile-card-delete-button');
    this.bulkBarMobile = page.getByTestId('bets-bulk-bar-mobile');
    this.bulkSelectedCountMobile = page.getByTestId('bets-bulk-selected-count-mobile');
    this.bulkResultSelectMobile = page.getByTestId('bets-bulk-result-select-mobile');
    this.bulkCashOutInputMobile = page.getByTestId('bets-bulk-cash-out-input-mobile');
    this.bulkApplyButtonMobile = page.getByTestId('bets-bulk-apply-button-mobile');
    this.bulkClearButtonMobile = page.getByTestId('bets-bulk-clear-button-mobile');
    this.bulkErrorMobile = page.getByTestId('bets-bulk-error-mobile');

    this.deleteModal = page.getByTestId('bets-delete-modal');
    this.deleteModalCloseButton = page.getByTestId('bets-delete-modal-close-button');
    this.deleteModalFixture = page.getByTestId('bets-delete-modal-fixture');
    this.deleteModalDescription = page.getByTestId('bets-delete-modal-description');
    this.deleteModalError = page.getByTestId('bets-delete-modal-error');
    this.deleteModalCancelButton = page.getByTestId('bets-delete-modal-cancel-button');
    this.deleteModalConfirmButton = page.getByTestId('bets-delete-modal-confirm-button');

    this.fetchError = page.getByTestId('bets-fetch-error');
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

  static readonly COLUMN_LABELS: Record<(typeof BetsPage.COLUMN_KEYS)[number], string> = {
    date: 'Date',
    fixture: 'Fixture',
    bookie: 'Bookie',
    description: 'Description',
    stakeType: 'Stake Type',
    stake: 'Stake (£)',
    odds: 'Odds',
    result: 'Result',
    profitLoss: 'P/L',
  };

  /** Cosmetic check for the table controls bar (rows-per-page + Columns button) and desktop table headers, in their default state. */
  async expectTableControlsAndHeadersCosmeticElements() {
    await expect(this.rowsPerPageSelect, 'Rows-per-page selector should default to "10"').toHaveValue('10');
    await expect(
      this.rowsPerPageSelect.locator('option'),
      'Rows-per-page selector should offer 5/10/25/50/100 in order',
    ).toHaveText(['5', '10', '25', '50', '100']);

    await expect(this.columnsToggleButton, '"Columns" toggle button should be visible').toBeVisible();
    await expect(this.columnsToggleButton, '"Columns" toggle button should read "Columns"').toHaveText('Columns');
    await expect(this.columnsMenu, 'Columns menu should be absent by default').toHaveCount(0);

    await expect(this.desktopTable, 'Desktop table should be visible').toBeVisible();
    for (const key of BetsPage.COLUMN_KEYS) {
      await expect(this.tableHeaders[key], `"${BetsPage.COLUMN_LABELS[key]}" header should be visible`).toBeVisible();
      await expect(
        this.tableHeaders[key],
        `"${BetsPage.COLUMN_LABELS[key]}" header should read "${BetsPage.COLUMN_LABELS[key]}"`,
      ).toContainText(BetsPage.COLUMN_LABELS[key]);
    }
    for (const key of BetsPage.SORTABLE_COLUMN_KEYS) {
      await expect(
        this.sortIndicators[key],
        `"${key}" sort indicator should default to "▲▼"`,
      ).toHaveText('▲▼');
    }
  }

  /** Cosmetic check for the mobile card view being visible and the desktop table being hidden below the `md` breakpoint. */
  async expectMobileCardViewCosmeticElements(expectedCardCount: number) {
    await expect(this.mobileCardContainer, 'Mobile card container should be visible').toBeVisible();
    await expect(this.mobileCards, 'Expected number of mobile cards should be rendered').toHaveCount(
      expectedCardCount,
    );
    await expect(this.desktopTable, 'Desktop table should be hidden below the md breakpoint').toBeHidden();
  }

  async openColumnsMenu() {
    await this.columnsToggleButton.click();
  }

  async uncheckColumn(key: (typeof BetsPage.COLUMN_KEYS)[number]) {
    await this.columnCheckboxes[key].locator('input[type="checkbox"]').uncheck();
  }

  async selectRowsPerPage(size: number) {
    await this.rowsPerPageSelect.selectOption(String(size));
  }

  async toggleSort(key: (typeof BetsPage.SORTABLE_COLUMN_KEYS)[number]) {
    await this.sortButtons[key].click();
  }

  async expectPageInfo(currentPage: number, totalPages: number) {
    await expect(this.paginationPageInfo, `Pagination text should read "Page ${currentPage} of ${totalPages}"`).toHaveText(
      `Page ${currentPage} of ${totalPages}`,
    );
  }

  async expectPaginationBoundaryState(options: { atFirstPage: boolean; atLastPage: boolean }) {
    if (options.atFirstPage) {
      await expect(this.paginationFirstButton, '"First page" button should be disabled at the first page').toBeDisabled();
      await expect(
        this.paginationPreviousButton,
        '"Previous page" button should be disabled at the first page',
      ).toBeDisabled();
    } else {
      await expect(this.paginationFirstButton, '"First page" button should be enabled').toBeEnabled();
      await expect(this.paginationPreviousButton, '"Previous page" button should be enabled').toBeEnabled();
    }
    if (options.atLastPage) {
      await expect(this.paginationNextButton, '"Next page" button should be disabled at the last page').toBeDisabled();
      await expect(this.paginationLastButton, '"Last page" button should be disabled at the last page').toBeDisabled();
    } else {
      await expect(this.paginationNextButton, '"Next page" button should be enabled').toBeEnabled();
      await expect(this.paginationLastButton, '"Last page" button should be enabled').toBeEnabled();
    }
  }

  async goToNextPage() {
    await this.paginationNextButton.click();
  }

  async goToPreviousPage() {
    await this.paginationPreviousButton.click();
  }

  async goToFirstPage() {
    await this.paginationFirstButton.click();
  }

  async goToLastPage() {
    await this.paginationLastButton.click();
  }

  // -------------------------------------------------------------------
  // Row selection & bulk actions
  // -------------------------------------------------------------------

  async toggleRowCheckbox(index: number) {
    await this.rowCheckboxes.nth(index).click();
  }

  async toggleMobileCardCheckbox(index: number) {
    await this.mobileCardCheckboxes.nth(index).click();
  }

  async toggleSelectAll() {
    await this.selectAllCheckbox.click();
  }

  async selectBulkResultDesktop(result: 'Open' | 'Win' | 'Loss' | 'Cashed Out') {
    await this.bulkResultSelectDesktop.selectOption(result);
  }

  async selectBulkResultMobile(result: 'Open' | 'Win' | 'Loss' | 'Cashed Out') {
    await this.bulkResultSelectMobile.selectOption(result);
  }

  async fillBulkCashOutValueDesktop(value: string) {
    await this.bulkCashOutInputDesktop.fill(value);
  }

  async fillBulkCashOutValueMobile(value: string) {
    await this.bulkCashOutInputMobile.fill(value);
  }

  async applyBulkResultDesktop() {
    await this.bulkApplyButtonDesktop.click();
  }

  async applyBulkResultMobile() {
    await this.bulkApplyButtonMobile.click();
  }

  async clearBulkSelectionDesktop() {
    await this.bulkClearButtonDesktop.click();
  }

  async clearBulkSelectionMobile() {
    await this.bulkClearButtonMobile.click();
  }

  /** Cosmetic check for the desktop selection controls and row action buttons in their default (unselected) state. */
  async expectDesktopSelectionCosmeticElements(expectedRowCount: number) {
    await expect(this.selectAllCheckboxHeader, 'Select-all checkbox header should be visible').toBeVisible();
    await expect(this.selectAllCheckbox, 'Select-all checkbox should be unchecked by default').not.toBeChecked();
    await expect(this.actionsHeader, 'Actions header should read "Actions"').toHaveText('Actions');

    await expect(this.rowCheckboxes, 'Expected number of row checkboxes should be rendered').toHaveCount(
      expectedRowCount,
    );
    for (let i = 0; i < expectedRowCount; i++) {
      await expect(this.rowCheckboxes.nth(i), `Row ${i} checkbox should be unchecked by default`).not.toBeChecked();
      await expect(this.rowEditButtons.nth(i), `Row ${i} "Edit" button should be visible`).toBeVisible();
      await expect(this.rowEditButtons.nth(i), `Row ${i} "Edit" button should read "Edit"`).toHaveText('Edit');
      await expect(this.rowDeleteButtons.nth(i), `Row ${i} "Delete" button should be visible`).toBeVisible();
      await expect(this.rowDeleteButtons.nth(i), `Row ${i} "Delete" button should read "Delete"`).toHaveText(
        'Delete',
      );
    }

    await expect(this.bulkBarDesktop, 'Desktop bulk bar should be absent from the DOM by default').toHaveCount(0);
  }

  /** Cosmetic check for the mobile selection controls and card action buttons in their default (unselected) state. */
  async expectMobileSelectionCosmeticElements(expectedCardCount: number) {
    await expect(
      this.mobileCardCheckboxes,
      'Expected number of mobile card checkboxes should be rendered',
    ).toHaveCount(expectedCardCount);
    for (let i = 0; i < expectedCardCount; i++) {
      await expect(
        this.mobileCardCheckboxes.nth(i),
        `Mobile card ${i} checkbox should be unchecked by default`,
      ).not.toBeChecked();
      await expect(this.mobileCardEditButtons.nth(i), `Mobile card ${i} "Edit" button should be visible`).toBeVisible();
      await expect(this.mobileCardEditButtons.nth(i), `Mobile card ${i} "Edit" button should read "Edit"`).toHaveText(
        'Edit',
      );
      await expect(
        this.mobileCardDeleteButtons.nth(i),
        `Mobile card ${i} "Delete" button should be visible`,
      ).toBeVisible();
      await expect(
        this.mobileCardDeleteButtons.nth(i),
        `Mobile card ${i} "Delete" button should read "Delete"`,
      ).toHaveText('Delete');
    }

    await expect(this.bulkBarMobile, 'Mobile bulk bar should be absent from the DOM by default').toHaveCount(0);
  }

  async expectBulkBarDesktopDefaultState(selectedCount: number) {
    await expect(this.bulkBarDesktop, 'Desktop bulk bar should be visible').toBeVisible();
    await expect(
      this.bulkSelectedCountDesktop,
      `Desktop selected count should read "${selectedCount} selected"`,
    ).toHaveText(`${selectedCount} selected`);
    await expect(this.bulkResultSelectDesktop, 'Desktop Result dropdown should default to "Open"').toHaveValue(
      'Open',
    );
    await expect(
      this.bulkCashOutInputDesktop,
      'Desktop Cash Out Value input should be absent unless "Cashed Out" is selected',
    ).toHaveCount(0);
    await expect(this.bulkApplyButtonDesktop, 'Desktop "Apply" button should be visible').toBeVisible();
    await expect(this.bulkClearButtonDesktop, 'Desktop "Clear" button should be visible').toBeVisible();
  }

  async expectBulkBarMobileDefaultState(selectedCount: number) {
    await expect(this.bulkBarMobile, 'Mobile bulk bar should be visible').toBeVisible();
    await expect(
      this.bulkSelectedCountMobile,
      `Mobile selected count should read "${selectedCount} selected"`,
    ).toHaveText(`${selectedCount} selected`);
    await expect(this.bulkResultSelectMobile, 'Mobile Result dropdown should default to "Open"').toHaveValue('Open');
    await expect(
      this.bulkCashOutInputMobile,
      'Mobile Cash Out Value input should be absent unless "Cashed Out" is selected',
    ).toHaveCount(0);
    await expect(this.bulkApplyButtonMobile, 'Mobile "Apply" button should be visible').toBeVisible();
    await expect(this.bulkClearButtonMobile, 'Mobile "Clear" button should be visible').toBeVisible();
  }

  // -------------------------------------------------------------------
  // Delete confirmation modal
  // -------------------------------------------------------------------

  async openDeleteModalForRow(index: number) {
    await this.rowDeleteButtons.nth(index).click();
  }

  async openDeleteModalForMobileCard(index: number) {
    await this.mobileCardDeleteButtons.nth(index).click();
  }

  async cancelDeleteModal() {
    await this.deleteModalCancelButton.click();
  }

  async closeDeleteModalViaCross() {
    await this.deleteModalCloseButton.click();
  }

  async confirmDelete() {
    await this.deleteModalConfirmButton.click();
  }

  async expectDeleteModalDetails(expected: { fixture: string; description: string }) {
    await expect(this.deleteModal, 'Delete confirmation modal should be visible').toBeVisible();
    await expect(this.deleteModalFixture, `Fixture line should read "Fixture: ${expected.fixture}"`).toHaveText(
      `Fixture: ${expected.fixture}`,
    );
    await expect(
      this.deleteModalDescription,
      `Description line should read "Description: ${expected.description}"`,
    ).toHaveText(`Description: ${expected.description}`);
  }
}


