import { Page, Locator, expect } from '@playwright/test';

/**
 * Component object for the Bets page's row selection and bulk actions —
 * per-row/select-all checkboxes, per-row "Edit"/"Delete" buttons, the
 * mobile card equivalents, and the desktop/mobile bulk result-update bars —
 * split out of `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-row-selection-bulk-actions.md.
 * Composed into `BetsPage` via `readonly rowSelection`.
 */
export class BetsRowSelectionComponent {
  readonly page: Page;

  // Desktop
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

  // Mobile card view
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

  constructor(page: Page) {
    this.page = page;

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
  }

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
  async expectDesktopCosmeticElements(expectedRowCount: number) {
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
  async expectMobileCosmeticElements(expectedCardCount: number) {
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
}
