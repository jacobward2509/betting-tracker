import { test, expect } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { seededPaginatedBetsFixture } from '@seed-data/bets';
import { deleteAccount, seedBets } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Bets Table Controls Tester';

// Exercises the Bets page's Columns menu, rows-per-page selector, sortable
// headers, and pagination controls, so it must always start logged out
// regardless of the project's default storageState (see
// playwright-ui-test-generation.md §4). A fresh account per test, seeded
// with 12 bets (distinct stake values 1-12), guarantees a deterministic
// 2-page pagination state and sort order to assert against.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Bets Table Controls', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page, request }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
    if (token) await seedBets(request, token, seededPaginatedBetsFixture());
    await page.goto('/bets');
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Functional - Columns menu hidden by default', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await expect(betsPage.columnsMenu, 'Columns menu should be absent from the DOM').toHaveCount(0);
  });

  test('Functional - Columns menu appears with all columns checked after clicking the "Columns" toggle button', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openColumnsMenu();

    await expect(betsPage.columnsMenu, 'Columns menu should be visible').toBeVisible();
    for (const key of BetsPage.COLUMN_KEYS) {
      const checkbox = betsPage.columnCheckboxes[key];
      await expect(checkbox, `"${BetsPage.COLUMN_LABELS[key]}" checkbox should be visible`).toBeVisible();
      await expect(
        checkbox.locator('input[type="checkbox"]'),
        `"${BetsPage.COLUMN_LABELS[key]}" checkbox should be checked by default`,
      ).toBeChecked();
      await expect(
        checkbox,
        `"${BetsPage.COLUMN_LABELS[key]}" checkbox label should read "${BetsPage.COLUMN_LABELS[key]}"`,
      ).toContainText(BetsPage.COLUMN_LABELS[key]);
    }
  });

  test('Functional - Unchecking a column hides its header and cell in the desktop table', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openColumnsMenu();

    await betsPage.uncheckColumn('bookie');

    await expect(betsPage.tableHeaders.bookie, '"Bookie" header should no longer be present').toHaveCount(0);
    for (const key of BetsPage.COLUMN_KEYS.filter((k) => k !== 'bookie')) {
      await expect(
        betsPage.tableHeaders[key],
        `"${BetsPage.COLUMN_LABELS[key]}" header should be unaffected`,
      ).toBeVisible();
    }
  });

  test('Functional - Rows-per-page selector changes the number of rows displayed and the pagination page count', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await expect(betsPage.tableRows, 'Should render 10 rows by default').toHaveCount(10);

    await betsPage.selectRowsPerPage(5);

    await expect(betsPage.tableRows, 'Should render 5 rows after selecting page size 5').toHaveCount(5);
    await betsPage.expectPageInfo(1, 3);
  });

  test("Functional - Clicking a sortable header's sort button once sorts ascending and updates its indicator", async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);

    await betsPage.toggleSort('stake');

    await expect(betsPage.sortIndicators.stake, 'Stake sort indicator should change to "▲"').toHaveText('▲');
    const firstRowStakeCell = betsPage.tableRows.first().locator('td').nth(6);
    await expect(firstRowStakeCell, 'First row should show the lowest stake (£1) when sorted ascending').toHaveText(
      '£ 1',
    );
  });

  test("Functional - Clicking the same sortable header's sort button again sorts descending and updates its indicator", async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.toggleSort('stake');
    await expect(betsPage.sortIndicators.stake, 'Stake sort indicator should be "▲" after first click').toHaveText(
      '▲',
    );

    await betsPage.toggleSort('stake');

    await expect(betsPage.sortIndicators.stake, 'Stake sort indicator should change to "▼"').toHaveText('▼');
    const firstRowStakeCell = betsPage.tableRows.first().locator('td').nth(6);
    await expect(
      firstRowStakeCell,
      'First row should show the highest stake (£12) when sorted descending',
    ).toHaveText('£ 12');
  });

  test('Functional - Pagination buttons are disabled at the first page boundary', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.expectPaginationBoundaryState({ atFirstPage: true, atLastPage: false });
  });

  test('Functional - Pagination buttons are disabled at the last page boundary', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.goToLastPage();

    await betsPage.expectPageInfo(2, 2);
    await betsPage.expectPaginationBoundaryState({ atFirstPage: false, atLastPage: true });
  });

  test('Functional - "Next"/"Last" pagination buttons navigate forward through pages', async ({ page }) => {
    const betsPage = new BetsPage(page);

    await betsPage.goToNextPage();

    await betsPage.expectPageInfo(2, 2);
    await expect(betsPage.tableRows, 'Second page should show the remaining 2 bets').toHaveCount(2);
  });

  test('Functional - "Previous"/"First" pagination buttons navigate backward through pages', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.goToNextPage();
    await betsPage.expectPageInfo(2, 2);

    await betsPage.goToFirstPage();

    await betsPage.expectPageInfo(1, 2);
    await expect(betsPage.tableRows, 'First page should show 10 bets again').toHaveCount(10);
  });
});
