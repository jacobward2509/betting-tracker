import { test } from '@playwright/test';
import { TabNavPage } from '@pages/tab-nav.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Tab Nav Tester';

// This suite exercises the tab nav as seen by a freshly-signed-up account, so
// it must always start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4). A fresh account per
// test avoids collisions with parallel tests mutating shared account state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Tab Nav', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Cosmetic - TabNav renders correctly on /bets', async ({ page }) => {
    const tabNavPage = new TabNavPage(page);
    await tabNavPage.expectCosmeticElements('bets');
  });
});
