import { Page, Locator, expect } from '@playwright/test';
import { waitForResponse } from '@functions/index';
import { BetsSummaryStatsComponent } from './shared/bets-summary-stats.component';
import { BetsFiltersComponent } from './shared/bets-filters.component';
import { BetsTableControlsComponent } from './shared/bets-table-controls.component';
import { BetsTableComponent } from './shared/bets-table.component';
import { BetsPaginationComponent } from './shared/bets-pagination.component';
import { BetsMobileCardsComponent } from './shared/bets-mobile-cards.component';
import { BetsRowSelectionComponent } from './shared/bets-row-selection.component';
import { BetsDeleteModalComponent } from './shared/bets-delete-modal.component';
import { AddBetModalComponent } from './shared/add-bet-modal.component';
import { BETS_COLUMN_KEYS, BETS_COLUMN_LABELS, BETS_SORTABLE_COLUMN_KEYS } from './shared/bets-columns';

/**
 * Page Object for BetsView (`/bets`). Originally minimal (exposing only the
 * `addBetButton` landmark used by `ui-test-plan-auth-signup.md` to confirm
 * signup navigation) — extended over several test plans to cover the
 * summary stats bar, filters panel, table controls bar, desktop table,
 * pagination, mobile card view, row selection/bulk actions, the Delete
 * confirmation modal, and (this plan) the Add Bet modal. As that coverage
 * grew this file split into composed shared component classes
 * (`support/pages/shared/bets-*.component.ts`, `add-bet-modal.component.ts`)
 * per playwright-ui-test-generation.md §2/§3's composition convention,
 * rather than continuing to hold every locator directly — `BetsPage` itself
 * now only keeps the page-level landmarks (`addBetButton`, `fetchError`) and
 * the navigation-load helper, delegating everything else to its composed
 * components. Edit Bet remains out of scope — see
 * ui-test-plan-add-bet.md's "Out of Scope" section for the future plan that
 * will extend this page object further.
 */
export class BetsPage {
  readonly page: Page;

  readonly addBetButton: Locator;
  readonly fetchError: Locator;

  readonly summaryStats: BetsSummaryStatsComponent;
  readonly filters: BetsFiltersComponent;
  readonly tableControls: BetsTableControlsComponent;
  readonly table: BetsTableComponent;
  readonly pagination: BetsPaginationComponent;
  readonly mobileCards: BetsMobileCardsComponent;
  readonly rowSelection: BetsRowSelectionComponent;
  readonly deleteModal: BetsDeleteModalComponent;
  readonly addBetModal: AddBetModalComponent;

  static readonly COLUMN_KEYS = BETS_COLUMN_KEYS;
  static readonly SORTABLE_COLUMN_KEYS = BETS_SORTABLE_COLUMN_KEYS;
  static readonly COLUMN_LABELS = BETS_COLUMN_LABELS;

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
   *
   * `AddBetModal.vue` is rendered unconditionally alongside `BetsView`
   * (no `v-if`), so its `onMounted` reference-data fetches (`GET
   * /api/bookmakers`, `/api/bet-types`, `/api/markets`, `/api/fixtures`)
   * fire once, on this same navigation/reload — not when the modal is
   * later opened. Pass `waitForAddBetReferenceData: true` for any test that
   * will call `openAddBetModal()`, so those requests are awaited here,
   * where they actually happen, rather than being raced later.
   */
  static async expectBetsLoaded(
    page: Page,
    action: () => Promise<unknown>,
    options?: { waitForAddBetReferenceData?: boolean },
  ): Promise<void> {
    const betsResponsePromise = waitForResponse(page, 'GET', '/api/bets');
    const addBetReferenceDataPromises = options?.waitForAddBetReferenceData
      ? [
          waitForResponse(page, 'GET', '/api/bookmakers'),
          waitForResponse(page, 'GET', '/api/bet-types'),
          waitForResponse(page, 'GET', '/api/markets'),
          waitForResponse(page, 'GET', '/api/fixtures'),
        ]
      : [];
    await action();
    await Promise.all([betsResponsePromise, ...addBetReferenceDataPromises]);
  }

  constructor(page: Page) {
    this.page = page;

    this.addBetButton = page.getByTestId('add-bet-button');
    this.fetchError = page.getByTestId('bets-fetch-error');

    this.summaryStats = new BetsSummaryStatsComponent(page);
    this.filters = new BetsFiltersComponent(page);
    this.tableControls = new BetsTableControlsComponent(page);
    this.table = new BetsTableComponent(page);
    this.pagination = new BetsPaginationComponent(page);
    this.mobileCards = new BetsMobileCardsComponent(page);
    this.rowSelection = new BetsRowSelectionComponent(page);
    this.deleteModal = new BetsDeleteModalComponent(page);
    this.addBetModal = new AddBetModalComponent(page);
  }

  /** Lightweight smoke check: URL and one defining locator. */
  async expectLoaded() {
    await expect(this.page, 'Bets page URL should be /bets').toHaveURL(/\/bets/);
    await expect(this.addBetButton, '"Add Bet" button should be visible').toBeVisible();
  }

  /** Cosmetic check for the table controls bar and desktop table headers, in their default state (composes both components' checks). */
  async expectTableControlsAndHeadersCosmeticElements() {
    await this.tableControls.expectCosmeticElements();
    await this.table.expectCosmeticElements();
  }

  /**
   * Opens the Add Bet modal. `AddBetModal.vue`'s reference-data fetches
   * (`GET /api/bookmakers`, `/api/bet-types`, `/api/markets`,
   * `/api/fixtures`) run once, on the page's initial mount — not here on
   * click — since the modal component is always present in the DOM (only
   * its content is toggled via `v-if="show"`). Callers that need the
   * Fixture/Market/Bookmaker dropdowns populated must await those requests
   * up front via `expectBetsLoaded(page, action, { waitForAddBetReferenceData: true })`
   * during navigation, not here.
   */
  async openAddBetModal() {
    await this.addBetButton.click();
    await this.addBetModal.expectVisible();
  }

  async openDeleteModalForRow(index: number) {
    await this.rowSelection.rowDeleteButtons.nth(index).click();
  }

  async openDeleteModalForMobileCard(index: number) {
    await this.rowSelection.mobileCardDeleteButtons.nth(index).click();
  }
}
