import { Page, Locator, expect } from '@playwright/test';

/**
 * Component object for the Bets page's Delete confirmation modal — split
 * out of `BetsPage` per
 * playwright/docs/test-plans/ui/bets/ui-test-plan-bets-row-selection-bulk-actions.md.
 * Composed into `BetsPage` via `readonly deleteModal`.
 */
export class BetsDeleteModalComponent {
  readonly page: Page;

  readonly deleteModal: Locator;
  readonly deleteModalCloseButton: Locator;
  readonly deleteModalFixture: Locator;
  readonly deleteModalDescription: Locator;
  readonly deleteModalError: Locator;
  readonly deleteModalCancelButton: Locator;
  readonly deleteModalConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.deleteModal = page.getByTestId('bets-delete-modal');
    this.deleteModalCloseButton = page.getByTestId('bets-delete-modal-close-button');
    this.deleteModalFixture = page.getByTestId('bets-delete-modal-fixture');
    this.deleteModalDescription = page.getByTestId('bets-delete-modal-description');
    this.deleteModalError = page.getByTestId('bets-delete-modal-error');
    this.deleteModalCancelButton = page.getByTestId('bets-delete-modal-cancel-button');
    this.deleteModalConfirmButton = page.getByTestId('bets-delete-modal-confirm-button');
  }

  async cancel() {
    await this.deleteModalCancelButton.click();
  }

  async closeViaCross() {
    await this.deleteModalCloseButton.click();
  }

  async confirm() {
    await this.deleteModalConfirmButton.click();
  }

  async expectDetails(expected: { fixture: string; description: string }) {
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
