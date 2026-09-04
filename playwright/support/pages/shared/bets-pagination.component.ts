import { Page, Locator, expect } from '@playwright/test';

/**
 * Component object for the Bets page's pagination controls — split out of
 * `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-table-display.md.
 * Composed into `BetsPage` via `readonly pagination`.
 */
export class BetsPaginationComponent {
  readonly page: Page;

  readonly pagination: Locator;
  readonly paginationFirstButton: Locator;
  readonly paginationPreviousButton: Locator;
  readonly paginationPageInfo: Locator;
  readonly paginationNextButton: Locator;
  readonly paginationLastButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.pagination = page.getByTestId('bets-pagination');
    this.paginationFirstButton = page.getByTestId('bets-pagination-first-button');
    this.paginationPreviousButton = page.getByTestId('bets-pagination-previous-button');
    this.paginationPageInfo = page.getByTestId('bets-pagination-page-info');
    this.paginationNextButton = page.getByTestId('bets-pagination-next-button');
    this.paginationLastButton = page.getByTestId('bets-pagination-last-button');
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

  async expectPageInfo(currentPage: number, totalPages: number) {
    await expect(this.paginationPageInfo, `Pagination text should read "Page ${currentPage} of ${totalPages}"`).toHaveText(
      `Page ${currentPage} of ${totalPages}`,
    );
  }

  async expectBoundaryState(options: { atFirstPage: boolean; atLastPage: boolean }) {
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
}
