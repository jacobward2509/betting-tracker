import { test } from '@playwright/test';
import { TabNavPage } from '@pages/tab-nav.page';
import { BetsPage } from '@pages/bets.page';
import { OverallStatsPage } from '@pages/overall-stats.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Tab Nav Journey Tester';

// This journey exercises the tab nav's cross-page navigation as seen by a
// freshly-signed-up account, so it must always start logged out regardless
// of the project's default storageState (see
// playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Tab Nav Journey', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('User can navigate from Bets to Overall Stats and back via the tab nav', async ({ page }) => {
    const tabNavPage = new TabNavPage(page);

    // Starting point after signup is /bets — confirm the Bets tab is active.
    await tabNavPage.expectActiveTab('bets');

    await tabNavPage.clickOverallStatsTab();

    const overallStatsPage = new OverallStatsPage(page);
    await overallStatsPage.expectLoaded();
    await tabNavPage.expectActiveTab('overallStats');

    await tabNavPage.clickBetsTab();

    const betsPage = new BetsPage(page);
    await betsPage.expectLoaded();
    await tabNavPage.expectActiveTab('bets');
  });
});
