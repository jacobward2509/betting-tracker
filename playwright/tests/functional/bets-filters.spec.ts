import { test, expect } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { seededBetsFixture } from '@seed-data/bets';
import { deleteAccount, seedBets } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Bets Filters Tester';

// Mirrors getSeasonLabel(getCurrentSeasonKey()) from
// apps/web/src/utils/season.ts (August-July season, "YYYY/YY" display
// label) — duplicated here rather than importing across the app/test
// boundary, matching the existing convention of page objects owning their
// own expected-value constants (e.g. EXPECTED_BOOKMAKERS in bets.page.ts).
function currentSeasonLabel(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0 = Jan, 7 = Aug
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

// Exercises the Bets page filter panel's interactive behaviour (expand/
// collapse, dropdown defaults/options, active-filter badge, Clear button),
// so it must always start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4). A fresh account
// per test, seeded with a known/deterministic set of bets, guarantees the
// exact filter option lists these scenarios assert against.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Bets Filters', () => {
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

  test('Functional - Filter panel body hidden by default', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.filters.expectPanelHidden();
  });

  test('Functional - Filter panel body appears after clicking the "Filters" toggle button', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.filters.toggleFilters();
    await betsPage.filters.expectPanelVisible();
  });

  test('Functional - Filter dropdowns show correct default state and options', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.filters.toggleFilters();

    await expect(
      betsPage.filters.seasonSelect,
      `Season should default to "${currentSeasonLabel()}"`,
    ).toHaveValue(currentSeasonLabel());
    await expect(
      betsPage.filters.seasonSelect.locator('option'),
      'Season dropdown should only offer the current season (all seeded bets are placed "now")',
    ).toHaveText([currentSeasonLabel()]);

    await expect(betsPage.filters.bookieSelect, 'Bookie should default to "All Bookies"').toHaveValue('');
    await expect(
      betsPage.filters.bookieSelect.locator('option'),
      'Bookie dropdown should offer "All Bookies" plus both seeded bookmakers, alphabetically',
    ).toHaveText(['All Bookies', 'Bet365', 'Sky Bet']);

    await expect(betsPage.filters.stakeTypeSelect, 'Stake Type should default to "All Stake Types"').toHaveValue('');
    await expect(
      betsPage.filters.stakeTypeSelect.locator('option'),
      'Stake Type dropdown should offer "All Stake Types" plus both seeded stake types',
    ).toHaveText(['All Stake Types', 'Free', 'Normal']);

    await expect(betsPage.filters.resultSelect, 'Result should default to "All Results"').toHaveValue('');
    await expect(
      betsPage.filters.resultSelect.locator('option'),
      'Result dropdown should offer "All Results" plus both seeded results, in the order they first appear in the seeded bets (Win seeded before Loss)',
    ).toHaveText(['All Results', 'Win', 'Loss']);


    await expect(betsPage.filters.fixtureInput, 'Fixture input should be empty by default').toBeEmpty();
    await expect(betsPage.filters.dateInput, 'Date input should be empty by default').toBeEmpty();
  });

  test('Functional - Active-filter badge and "Clear" button appear after setting a filter', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.filters.toggleFilters();
    await betsPage.filters.expectNoActiveFilterBadge();

    await betsPage.filters.selectBookie('Bet365');

    await betsPage.filters.expectActiveFilterBadge(1);
  });

  test('Functional - "Clear" button resets all filters', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.filters.toggleFilters();
    await betsPage.filters.selectBookie('Bet365');
    await betsPage.filters.expectActiveFilterBadge(1);

    await betsPage.filters.clearFilters();

    await betsPage.filters.expectNoActiveFilterBadge();
    await expect(
      betsPage.filters.seasonSelect,
      'Season should revert to the current season label',
    ).toHaveValue(currentSeasonLabel());
    await expect(betsPage.filters.bookieSelect, 'Bookie should revert to "All Bookies"').toHaveValue('');
    await expect(betsPage.filters.stakeTypeSelect, 'Stake Type should revert to "All Stake Types"').toHaveValue('');
    await expect(betsPage.filters.resultSelect, 'Result should revert to "All Results"').toHaveValue('');
    await expect(betsPage.filters.fixtureInput, 'Fixture input should be emptied').toBeEmpty();
    await expect(betsPage.filters.dateInput, 'Date input should be emptied').toBeEmpty();
  });
});


