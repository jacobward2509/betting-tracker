import { test, expect } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { seededBetsFixture } from '@seed-data/bets';
import { deleteAccount, seedBets, waitForResponse } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Add Bet Journey Tester';

// End-to-end journey coverage: a bet added through AddBetModalComponent must
// correctly appear in the Bets table, update the summary stats, and be
// surfaced/excluded correctly by the filters panel — closing the gap
// previously (and inaccurately) attributed to
// ui-test-plan-bets-summary-filters.md / ui-test-plan-bets-table-display.md /
// ui-test-plan-bets-row-selection-bulk-actions.md, none of which actually
// drive a bet through the modal (they all seed via POST /api/bets
// directly). See ui-test-plan-add-bet.md Scenarios 18-19.
//
// Must always start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4). A fresh account
// per test, seeded with a small known baseline via seedBets(), gives a
// deterministic non-zero starting point to assert the increment against.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Add Bet - End-to-End Journey', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page, request }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
    if (token) await seedBets(request, token, seededBetsFixture());
    await BetsPage.expectBetsLoaded(page, () => page.goto('/bets'));
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Functional - End-to-end: a bet added via the modal appears correctly in the Bets table and updates the summary stats', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);

    // Baseline from seededBetsFixture(): 3 bets, Total P/L £5.00 (see
    // support/seed-data/bets/index.ts for the exact breakdown).
    await betsPage.summaryStats.expectCosmeticElements({
      totalBets: '3',
      favouriteBookie: 'Bet365',
      totalProfitLossText: '£ 5.00',
      totalProfitLossClass: 'text-green-700',
    });
    const rowCountBefore = await betsPage.table.tableRows.count();

    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.fixtureSelect.selectOption({ index: 1 });
    await modal.marketSelect.selectOption({ index: 1 });
    // "Bet365" is a single-word bookmaker token, so formatBookmakerLabel()
    // (apps/web/src/utils/bookmaker.ts) renders it unchanged — avoids any
    // ambiguity between the dropdown's raw enum value and the table's
    // formatted display label that picking by index could introduce.
    await modal.bookmakerSelect.selectOption('Bet365');
    await modal.stakeInput.fill('20');
    await modal.oddsInput.fill('3');
    // Result defaults to "Open" (profit 0), so Total P/L stays £5.00 —
    // isolates the assertion to Total Bets incrementing without needing to
    // recompute a new expected P/L sum.

    const betPostPromise = waitForResponse(page, 'POST', '/api/bets');
    await modal.submit();
    await betPostPromise;
    await modal.addAnotherNoButton.click();
    await expect(modal.modal, 'Modal should close after declining "Add another?"').toHaveCount(0);

    await expect(
      betsPage.table.tableRows,
      'A new row should be added to the Bets table',
    ).toHaveCount(rowCountBefore + 1);

    const newRow = betsPage.table.tableRows.first();
    await expect(newRow, 'New row should show the submitted stake').toContainText('£ 20');
    await expect(newRow, 'New row should show the submitted bookmaker').toContainText('Bet365');
    await expect(newRow, 'New row should show the default "Open" result').toContainText('Open');

    await expect(
      betsPage.summaryStats.totalCountValue,
      'Total Bets count should increment by 1',
    ).toHaveText('4');
    await expect(
      betsPage.summaryStats.totalProfitLossValue,
      'Total P/L should be unchanged (£5.00) since the new bet is still "Open" (profit 0)',
    ).toHaveText('£ 5.00');
  });

  test('Functional - End-to-end: a freshly-added bet is discoverable via the Bets page filters and excluded when filtered out', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);

    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.fixtureSelect.selectOption({ index: 1 });
    await modal.marketSelect.selectOption({ index: 1 });
    // "SkyBet" is one of the two bookmakers already present in
    // seededBetsFixture() (support/seed-data/bets/index.ts), so selecting it
    // as the filter's target value below is guaranteed to already be an
    // offered Bookie filter option, rather than depending on option-list
    // timing for a value that's brand new to this account's bets.
    await modal.bookmakerSelect.selectOption('SkyBet');

    const betPostPromise = waitForResponse(page, 'POST', '/api/bets');
    await modal.submit();
    await betPostPromise;
    await modal.addAnotherNoButton.click();
    await expect(modal.modal, 'Modal should close after declining "Add another?"').toHaveCount(0);

    await betsPage.filters.toggleFilters();
    await betsPage.filters.selectBookie('SkyBet');

    await expect(
      betsPage.table.tableRows,
      'The new bet\'s row should remain visible when filtering by its own Bookie value',
    ).toHaveCount(2); // the new bet + the one pre-seeded SkyBet bet.

    await betsPage.filters.selectBookie('Bet365');

    await expect(
      betsPage.table.tableRows,
      'The new bet\'s row should no longer be present when filtering by a different Bookie value',
    ).toHaveCount(2); // the two pre-seeded Bet365 bets only.
  });
});
