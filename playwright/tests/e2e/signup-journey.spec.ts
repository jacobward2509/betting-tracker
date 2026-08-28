import { test } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Cline QA Test';

test.describe('Signup Journey', () => {
  test.describe.configure({ mode: 'serial' });
  let token: string | undefined;

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('User can sign up with default preferences and land on the Bets page', async ({
    page,
  }) => {
    token = await signUp(page, {
      name: VALID_NAME,
      email: randomSignupEmail(),
      password: VALID_PASSWORD,
    });

    const betsPage = new BetsPage(page);
    await betsPage.expectLoaded();
  });

  test('User can sign up with configured Betting Preferences and land on the Bets page', async ({
    page,
  }) => {
    token = await signUp(page, {
      name: VALID_NAME,
      email: randomSignupEmail(),
      password: VALID_PASSWORD,
      preferences: {
        bookmakersToUncheck: ['Betfair'],
        defaultBetType: 'Accumulator',
        defaultStake: '10',
      },
    });

    const betsPage = new BetsPage(page);
    await betsPage.expectLoaded();
  });
});
