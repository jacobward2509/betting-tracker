import { test, expect } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { seededBetsFixture } from '@seed-data/bets';
import { deleteAccount, seedBets, waitForResponse } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Bets Bulk Actions Tester';

// Exercises the Bets page's row selection, bulk result-update bar (desktop
// and mobile), and Delete confirmation modal, so it must always start logged
// out regardless of the project's default storageState (see
// playwright-ui-test-generation.md §4). A fresh account per test, seeded
// with the standard 3-bet fixture (bet 1 WON, bet 2 LOST, bet 3 LOST/FREE —
// see seededBetsFixture()'s own comment for the exact profit/order
// rationale), gives deterministic bets to select/apply/delete against.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Bets Bulk Actions', () => {
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

  test('Functional - Selecting a desktop row checkbox reveals the desktop bulk bar', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(0);

    await betsPage.rowSelection.expectBulkBarDesktopDefaultState(1);
  });

  test('Functional - Selecting a mobile card checkbox reveals the mobile bulk bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await BetsPage.expectBetsLoaded(page, () => page.reload());

    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleMobileCardCheckbox(0);

    await betsPage.rowSelection.expectBulkBarMobileDefaultState(1);
  });

  test('Functional - Select-all checkbox selects every row on the current page (desktop)', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleSelectAll();

    await expect(betsPage.rowSelection.selectAllCheckbox, 'Select-all checkbox should be checked').toBeChecked();
    for (let i = 0; i < 3; i++) {
      await expect(betsPage.rowSelection.rowCheckboxes.nth(i), `Row ${i} checkbox should be checked`).toBeChecked();
    }
    await betsPage.rowSelection.expectBulkBarDesktopDefaultState(3);
  });

  test('Functional - Select-all checkbox becomes indeterminate when only some rows on the page are selected', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleSelectAll();
    await expect(betsPage.rowSelection.selectAllCheckbox, 'Select-all checkbox should be checked initially').toBeChecked();

    await betsPage.rowSelection.toggleRowCheckbox(0);

    await expect(betsPage.rowSelection.selectAllCheckbox, 'Select-all checkbox should no longer be checked').not.toBeChecked();
    const isIndeterminate = await betsPage.rowSelection.selectAllCheckbox.evaluate((el: HTMLInputElement) => el.indeterminate);
    expect(isIndeterminate, 'Select-all checkbox should be indeterminate').toBe(true);
    await expect(
      betsPage.rowSelection.bulkSelectedCountDesktop,
      'Selected count should decrease by 1 to "2 selected"',
    ).toHaveText('2 selected');
  });

  test('Functional - Select-all checkbox deselects every row on the current page when clicked while fully selected', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleSelectAll();
    await expect(betsPage.rowSelection.selectAllCheckbox, 'Select-all checkbox should be checked initially').toBeChecked();

    await betsPage.rowSelection.toggleSelectAll();

    await expect(betsPage.rowSelection.selectAllCheckbox, 'Select-all checkbox should become unchecked').not.toBeChecked();
    const isIndeterminate = await betsPage.rowSelection.selectAllCheckbox.evaluate((el: HTMLInputElement) => el.indeterminate);
    expect(isIndeterminate, 'Select-all checkbox should not be indeterminate').toBe(false);
    for (let i = 0; i < 3; i++) {
      await expect(betsPage.rowSelection.rowCheckboxes.nth(i), `Row ${i} checkbox should be unchecked`).not.toBeChecked();
    }
    await expect(betsPage.rowSelection.bulkBarDesktop, 'Desktop bulk bar should disappear').toHaveCount(0);
  });

  test('Functional - Selecting "Cashed Out" in the bulk Result dropdown reveals the Cash Out Value input (desktop)', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(0);

    await betsPage.rowSelection.selectBulkResultDesktop('Cashed Out');

    await expect(betsPage.rowSelection.bulkCashOutInputDesktop, 'Cash Out Value input should become visible').toBeVisible();
    await expect(betsPage.rowSelection.bulkCashOutInputDesktop, 'Cash Out Value input should be empty').toHaveValue('');
    await expect(
      betsPage.rowSelection.bulkCashOutInputDesktop,
      'Cash Out Value input should have the placeholder "Cash Out Value"',
    ).toHaveAttribute('placeholder', 'Cash Out Value');
  });

  test('Functional - Switching away from "Cashed Out" hides the Cash Out Value input again (desktop)', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(0);
    await betsPage.rowSelection.selectBulkResultDesktop('Cashed Out');
    await expect(betsPage.rowSelection.bulkCashOutInputDesktop, 'Cash Out Value input should be visible initially').toBeVisible();

    await betsPage.rowSelection.selectBulkResultDesktop('Open');

    await expect(betsPage.rowSelection.bulkCashOutInputDesktop, 'Cash Out Value input should be removed from the DOM').toHaveCount(
      0,
    );
  });

  test('Functional - Applying a bulk result with "Cashed Out" but no Cash Out Value shows an inline error, not a native dialog (desktop)', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(0);
    await betsPage.rowSelection.selectBulkResultDesktop('Cashed Out');

    let dialogFired = false;
    page.once('dialog', () => {
      dialogFired = true;
    });

    await betsPage.rowSelection.applyBulkResultDesktop();

    await expect(
      betsPage.rowSelection.bulkErrorDesktop,
      'Inline bulk error should read the Cash Out Value validation message',
    ).toHaveText('Please enter a valid Cash Out value for Cashed Out.');
    expect(dialogFired, 'No native browser dialog should be triggered').toBe(false);
    await expect(betsPage.rowSelection.bulkBarDesktop, 'Desktop bulk bar should remain visible').toBeVisible();
    await expect(betsPage.rowSelection.rowCheckboxes.nth(0), 'Selection should remain unchanged').toBeChecked();
  });

  test('Functional - Applying a bulk "Win" result updates the selected bet and clears selection (desktop)', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    // Bet at row 1 (index 1) starts as "Loss" (seededBetsFixture's second bet) — select
    // it and apply "Win" so the result badge change is unambiguous.
    await betsPage.rowSelection.toggleRowCheckbox(1);
    await betsPage.rowSelection.selectBulkResultDesktop('Win');

    const bulkResultPromise = waitForResponse(page, 'PATCH', '/api/bets/bulk-result');
    await betsPage.rowSelection.applyBulkResultDesktop();
    const bulkResultResponse = await bulkResultPromise;

    expect(bulkResultResponse.ok(), 'PATCH /api/bets/bulk-result should succeed').toBe(true);
    await expect(betsPage.rowSelection.bulkBarDesktop, 'Desktop bulk bar should disappear (selection cleared)').toHaveCount(0);
    await expect(betsPage.rowSelection.rowCheckboxes.nth(1), 'Row 1 checkbox should be unchecked again').not.toBeChecked();
    await expect(betsPage.table.tableRows.nth(1), 'Updated row should show "Win"').toContainText('Win');
  });

  test('Functional - Applying a bulk "Cashed Out" result with a valid Cash Out Value updates the selected bet (desktop)', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(1);
    await betsPage.rowSelection.selectBulkResultDesktop('Cashed Out');
    await betsPage.rowSelection.fillBulkCashOutValueDesktop('12.50');

    const bulkResultPromise = waitForResponse(page, 'PATCH', '/api/bets/bulk-result');
    await betsPage.rowSelection.applyBulkResultDesktop();
    const bulkResultResponse = await bulkResultPromise;

    expect(bulkResultResponse.ok(), 'PATCH /api/bets/bulk-result should succeed').toBe(true);
    await expect(betsPage.rowSelection.bulkBarDesktop, 'Desktop bulk bar should disappear (selection cleared)').toHaveCount(0);
    await expect(
      betsPage.table.tableRows.nth(1),
      'Updated row should show the "Cashed Out" result and cash out amount',
    ).toContainText('Cashed Out');
    await expect(betsPage.table.tableRows.nth(1)).toContainText('Amount: £12.50');
  });

  test('Functional - Applying a bulk result across multiple selected rows updates every selected bet (desktop)', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(0);
    await betsPage.rowSelection.toggleRowCheckbox(1);
    await betsPage.rowSelection.selectBulkResultDesktop('Loss');

    const bulkResultPromise = waitForResponse(page, 'PATCH', '/api/bets/bulk-result');
    await betsPage.rowSelection.applyBulkResultDesktop();
    const bulkResultResponse = await bulkResultPromise;

    expect(bulkResultResponse.ok(), 'PATCH /api/bets/bulk-result should succeed').toBe(true);
    const requestBody = bulkResultResponse.request().postDataJSON();
    expect(requestBody.ids, 'Request should include both selected bet ids').toHaveLength(2);
    await expect(betsPage.rowSelection.bulkBarDesktop, 'Desktop bulk bar should disappear (selection cleared)').toHaveCount(0);
    await expect(betsPage.table.tableRows.nth(0), 'First updated row should show "Loss"').toContainText('Loss');
    await expect(betsPage.table.tableRows.nth(1), 'Second updated row should show "Loss"').toContainText('Loss');
  });

  test('Functional - Applying a bulk result from the mobile bulk bar updates the selected bet (mobile)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await BetsPage.expectBetsLoaded(page, () => page.reload());

    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleMobileCardCheckbox(1);
    await betsPage.rowSelection.selectBulkResultMobile('Win');

    const bulkResultPromise = waitForResponse(page, 'PATCH', '/api/bets/bulk-result');
    await betsPage.rowSelection.applyBulkResultMobile();
    const bulkResultResponse = await bulkResultPromise;

    expect(bulkResultResponse.ok(), 'PATCH /api/bets/bulk-result should succeed').toBe(true);
    await expect(betsPage.rowSelection.bulkBarMobile, 'Mobile bulk bar should disappear (selection cleared)').toHaveCount(0);
    await expect(betsPage.mobileCards.mobileCards.nth(1), 'Updated mobile card should show "Win"').toContainText('Win');
  });

  test('Functional - "Clear" button resets selection without applying any change', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(0);
    await betsPage.rowSelection.selectBulkResultDesktop('Win');

    let bulkRequestSent = false;
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes('/api/bets/bulk-result')) {
        bulkRequestSent = true;
      }
    });

    await betsPage.rowSelection.clearBulkSelectionDesktop();

    expect(bulkRequestSent, 'No PATCH /api/bets/bulk-result request should be sent').toBe(false);
    await expect(betsPage.rowSelection.bulkBarDesktop, 'Desktop bulk bar should disappear').toHaveCount(0);
    await expect(betsPage.rowSelection.rowCheckboxes.nth(0), 'Row checkbox should be unchecked').not.toBeChecked();
  });

  test('Functional - Delete confirmation modal opens with the correct bet\'s details and can be dismissed without deleting', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    // Read the target row's fixture/description text before opening the modal,
    // so the assertion doesn't hardcode values that could drift from seed data.
    const fixtureCell = betsPage.table.tableRows.nth(0).locator('td').nth(2);
    const fixtureText = (await fixtureCell.textContent())?.trim() ?? '';

    let deleteRequestSent = false;
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && req.url().includes('/api/bets/')) {
        deleteRequestSent = true;
      }
    });

    await betsPage.openDeleteModalForRow(0);
    await expect(betsPage.deleteModal.deleteModalFixture, 'Fixture line should mention the correct fixture').toHaveText(
      `Fixture: ${fixtureText}`,
    );

    await betsPage.deleteModal.cancel();

    expect(deleteRequestSent, 'No DELETE /api/bets/:id request should be sent').toBe(false);
    await expect(betsPage.deleteModal.deleteModal, 'Delete confirmation modal should be removed from the DOM').toHaveCount(0);
    await expect(betsPage.table.tableRows, 'The bet should remain in the table').toHaveCount(3);
  });

  test('Functional - Confirming deletion removes the bet from the table', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openDeleteModalForRow(0);

    const deleteResponsePromise = waitForResponse(page, 'DELETE', '/api/bets/');
    await betsPage.deleteModal.confirm();
    const deleteResponse = await deleteResponsePromise;

    expect(deleteResponse.ok(), 'DELETE /api/bets/:id should succeed').toBe(true);
    await expect(betsPage.deleteModal.deleteModal, 'Delete confirmation modal should close').toHaveCount(0);
    await expect(betsPage.table.tableRows, 'Row count should decrease by 1').toHaveCount(2);
    await expect(
      betsPage.summaryStats.totalCountValue,
      'Total Bets count in the summary stats bar should decrease by 1',
    ).toHaveText('2');
  });

  test('Functional - A failed bulk-apply request shows an inline error, not a native dialog, and preserves selection', async ({
    page,
  }) => {
    await page.route('**/api/bets/bulk-result', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated bulk-apply failure' }),
      });
    });

    const betsPage = new BetsPage(page);
    await betsPage.rowSelection.toggleRowCheckbox(0);
    await betsPage.rowSelection.selectBulkResultDesktop('Win');

    let dialogFired = false;
    page.once('dialog', () => {
      dialogFired = true;
    });

    await betsPage.rowSelection.applyBulkResultDesktop();

    await expect(betsPage.rowSelection.bulkErrorDesktop, 'Inline bulk error should show the returned error message').toHaveText(
      'Simulated bulk-apply failure',
    );
    expect(dialogFired, 'No native browser dialog should be triggered').toBe(false);
    await expect(betsPage.rowSelection.bulkBarDesktop, 'Desktop bulk bar should remain visible').toBeVisible();
    await expect(betsPage.rowSelection.rowCheckboxes.nth(0), 'Selection should be preserved, not cleared').toBeChecked();
  });

  test('Functional - A failed delete request shows an inline error, not a native dialog, and keeps the modal open', async ({
    page,
  }) => {
    await page.route('**/api/bets/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Simulated delete failure' }),
        });
      } else {
        await route.continue();
      }
    });

    const betsPage = new BetsPage(page);
    await betsPage.openDeleteModalForRow(0);

    let dialogFired = false;
    page.once('dialog', () => {
      dialogFired = true;
    });

    await betsPage.deleteModal.confirm();

    await expect(betsPage.deleteModal.deleteModalError, 'Inline delete error should read the failure message').toHaveText(
      'Failed to delete bet. Please try again.',
    );
    expect(dialogFired, 'No native browser dialog should be triggered').toBe(false);
    await expect(betsPage.deleteModal.deleteModal, 'Delete confirmation modal should remain open').toBeVisible();
    await expect(betsPage.table.tableRows, 'The bet should remain in the table').toHaveCount(3);
  });
});
