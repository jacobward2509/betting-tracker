import { test, expect } from '@playwright/test';
import { BetsPage } from '@pages/bets.page';
import { TopBannerPage } from '@pages/top-banner.page';
import { signUp } from '@journeys/signup.journey';
import { randomSignupEmail } from '@seed-data/auth/signup';
import { deleteAccount, waitForResponse } from '@functions/index';

const VALID_PASSWORD = 'a-valid-password-123';
const VALID_NAME = 'Add Bet Functional Tester';

// Exercises the Add Bet modal's bet-type-driven conditional rendering and
// submit behaviour, so it must always start logged out regardless of the
// project's default storageState (see playwright-ui-test-generation.md §4).
// A fresh account per test avoids cross-test data interference — see
// ui-test-plan-add-bet.md Scenarios 3-17.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Add Bet Modal - Conditional Fields & Submission', () => {
  let token: string | undefined;

  test.beforeEach(async ({ page }) => {
    const email = randomSignupEmail();
    token = await signUp(page, { name: VALID_NAME, email, password: VALID_PASSWORD });
    await BetsPage.expectBetsLoaded(page, () => page.goto('/bets'));
  });

  test.afterEach(async ({ request }) => {
    if (token) await deleteAccount(request, token);
    token = undefined;
  });

  test('Functional - Selecting "Other" reveals the free-text Bet Type input', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.betTypeSelect.selectOption('Other');

    await expect(modal.otherBetTypeInput, 'Other Bet Type input should become visible').toBeVisible();
    await expect(modal.betTypeSelect, 'Bet Type dropdown value should remain "Other"').toHaveValue('Other');
  });

  test('Functional - Selecting a multi-leg bet type swaps Fixture/Market/Player/Selection for the Legs editor', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.betTypeSelect.selectOption('Accumulator');

    await expect(modal.legsLabel, 'Legs label should become visible').toBeVisible();
    await modal.legsEditor.expectLegCount(2);
    await expect(modal.legsEditor.legFixtureLabel(0), 'Leg 0 Fixture label should be visible').toBeVisible();
    await expect(modal.legsEditor.legMarketLabel(0), 'Leg 0 Market label should be visible').toBeVisible();

    await expect(modal.fixtureLabel, 'Standalone Fixture label should be absent').toHaveCount(0);
    await expect(modal.marketLabel, 'Standalone Market label should be absent').toHaveCount(0);
    await expect(modal.playerLabel, 'Standalone Player label should be absent').toHaveCount(0);
    await expect(modal.selectionLabel, 'Standalone Selection label should be absent').toHaveCount(0);

    await expect(
      modal.legsEditor.rulesMessage,
      'Rule message should describe the Accumulator-specific rule',
    ).toContainText('Accumulator');
  });

  test('Functional - Selecting "Bet Builder" renders the shared single-fixture picker instead of a per-leg fixture picker', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.betTypeSelect.selectOption('Bet Builder');

    await expect(
      modal.legsEditor.betBuilderFixtureLabel,
      'Shared Bet Builder Fixture label should be visible',
    ).toBeVisible();
    await expect(
      modal.legsEditor.betBuilderFixtureSelect,
      'Shared Bet Builder Fixture dropdown should be visible',
    ).toBeVisible();
    await modal.legsEditor.expectLegCount(2);
    await expect(
      modal.legsEditor.legFixtureLabel(0),
      'Leg 0 own Fixture label should be absent (Bet Builder uses the shared fixture picker)',
    ).toHaveCount(0);
    await expect(
      modal.legsEditor.legFixtureLabel(1),
      'Leg 1 own Fixture label should be absent (Bet Builder uses the shared fixture picker)',
    ).toHaveCount(0);
    await expect(modal.legsEditor.legMarketLabel(0), 'Leg 0 Market label should still be visible').toBeVisible();
  });

  test('Functional - "+ Add leg" adds a leg and "Remove" removes it (Cross Match Bet Builder)', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.betTypeSelect.selectOption('Cross Match Bet Builder');
    await modal.legsEditor.expectLegCount(2);

    await modal.legsEditor.addLeg();
    await modal.legsEditor.expectLegCount(3);
    for (const index of [0, 1, 2]) {
      await expect(
        modal.legsEditor.removeLegButton(index),
        `Remove button for leg ${index} should be visible while more than 2 legs exist`,
      ).toBeVisible();
    }

    await modal.legsEditor.removeLeg(2);
    await modal.legsEditor.expectLegCount(2);
  });

  test('Functional - Selecting a listed Fixture (Player Prop) reveals the Market field, hidden beforehand', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await expect(modal.marketLabel, 'Market label should be absent before a fixture is selected').toHaveCount(0);

    await modal.fixtureSelect.selectOption({ index: 1 });

    await expect(modal.marketLabel, 'Market label should become visible after a fixture is selected').toBeVisible();
    await expect(modal.marketSelect, 'Market dropdown should become visible').toBeVisible();
  });

  test('Functional - Choosing "Other / not listed" in the Fixture dropdown reveals Home/Away Team inputs', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await expect(modal.homeTeamInput, 'Home Team input should be absent before "Other / not listed" is chosen').toHaveCount(0);
    await expect(modal.awayTeamInput, 'Away Team input should be absent before "Other / not listed" is chosen').toHaveCount(0);

    await modal.fixtureSelect.selectOption('__manual__');

    await expect(modal.homeTeamInput, 'Home Team input should become visible').toBeVisible();
    await expect(modal.awayTeamInput, 'Away Team input should become visible').toBeVisible();

    // Selecting a concrete fixture triggers GET /api/fixtures/:id/players
    // (useBetForm.ts's selectedFixtureId watcher) — wait for it to resolve
    // before asserting the Home/Away inputs have been removed, otherwise the
    // assertion can race the in-flight request.
    const playersPromise = waitForResponse(page, 'GET', '/players');
    await modal.fixtureSelect.selectOption({ index: 1 });
    await playersPromise;

    await expect(modal.homeTeamInput, 'Home Team input should become absent again for a listed fixture').toHaveCount(0);
    await expect(modal.awayTeamInput, 'Away Team input should become absent again for a listed fixture').toHaveCount(0);
  });

  test('Functional - Selecting a Market that requires a player reveals the Player field', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.fixtureSelect.selectOption({ index: 1 });
    // "Player Prop" scopes the Market dropdown to markets with
    // requiresPlayer=true (apps/api/scripts/seed-markets.ts's PLAYER_MARKETS),
    // so any listed option here always requires a player.
    await modal.marketSelect.selectOption({ index: 1 });

    await expect(modal.playerLabel, 'Player label should become visible').toBeVisible();
    await expect(modal.playerSelect, 'Player dropdown should become visible').toBeVisible();
  });

  test('Functional - Choosing "Other / not listed" in the Player dropdown reveals the manual Player input', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await modal.fixtureSelect.selectOption({ index: 1 });
    await modal.marketSelect.selectOption({ index: 1 });
    await expect(modal.playerSelect, 'Player dropdown should become visible').toBeVisible();

    await modal.playerSelect.selectOption('__manual__');

    await expect(modal.playerManualInput, 'Player manual text input should become visible').toBeVisible();
  });

  test('Functional - Selecting a Market with selections reveals the Selection (or combined Selection+Line) field', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    // Selecting a concrete fixture triggers GET /api/fixtures/:id/players
    // (useBetForm.ts's selectedFixtureId watcher) — wait for it to resolve
    // before interacting further, otherwise the Market dropdown's dependent
    // rendering can be exercised while that request is still in flight.
    const playersPromise = waitForResponse(page, 'GET', '/players');
    await modal.fixtureSelect.selectOption({ index: 1 });
    await playersPromise;
    await expect(modal.marketSelect, 'Market dropdown should become visible').toBeVisible();

    // "Anytime Goalscorer"/"First Goalscorer"/"Last Goalscorer"/"Player to be
    // Carded"/"Player to be Sent Off" are seeded Yes-only markets
    // (apps/api/scripts/seed-markets.ts) whose Selection field is
    // auto-applied and hidden. Every other Player market has 2+ selections
    // and shows one of the two Selection variants — pick the first such
    // option dynamically rather than hardcoding a specific market name.
    const YES_ONLY_MARKETS = [
      'Anytime Goalscorer',
      'First Goalscorer',
      'Last Goalscorer',
      'Player to be Carded',
      'Player to be Sent Off',
    ];

    await modal.marketSelect.selectOption({ label: 'Anytime Goalscorer' });
    await expect(modal.selectionLabel, 'Selection label should be absent for a Yes-only market').toHaveCount(0);

    const optionLabels = await modal.marketSelect.locator('option:not([value=""])').allTextContents();
    const nonYesOnlyLabel = optionLabels.find((label) => !YES_ONLY_MARKETS.includes(label));
    expect(nonYesOnlyLabel, 'At least one non-Yes-only Player market should be available').toBeTruthy();
    await modal.marketSelect.selectOption({ label: nonYesOnlyLabel! });

    const selectionVisible = modal.selectionLabel.or(modal.selectionLineSelect);
    await expect(
      selectionVisible,
      'Selection label (or combined Selection+Line dropdown) should become visible for a non-Yes-only market',
    ).toBeVisible();
  });

  test('Functional - Stake Type "Normal + Free" swaps the single Stake field for separate Normal/Free Stake fields', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await expect(modal.stakeLabel, 'Stake label should be visible by default').toBeVisible();

    await modal.stakeTypeSelect.selectOption('Normal + Free');

    await expect(modal.stakeLabel, 'Stake label should become absent').toHaveCount(0);
    await expect(modal.normalStakeLabel, 'Normal Stake label should become visible').toBeVisible();
    await expect(modal.normalStakeInput, 'Normal Stake input should become visible').toBeVisible();
    await expect(modal.freeStakeLabel, 'Free Stake label should become visible').toBeVisible();
    await expect(modal.freeStakeInput, 'Free Stake input should become visible').toBeVisible();

    await modal.stakeTypeSelect.selectOption('Normal');

    await expect(modal.stakeLabel, 'Stake label should be restored').toBeVisible();
    await expect(modal.normalStakeLabel, 'Normal Stake label should become absent again').toHaveCount(0);
    await expect(modal.freeStakeLabel, 'Free Stake label should become absent again').toHaveCount(0);
  });

  test('Functional - Checking "Odds Boost?" reveals the Boost (%) field', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await expect(modal.oddsBoostPercentLabel, 'Boost (%) label should be absent by default').toHaveCount(0);

    await modal.oddsBoostCheckbox.check();

    await expect(modal.oddsBoostPercentLabel, 'Boost (%) label should become visible').toBeVisible();
    await expect(modal.oddsBoostPercentInput, 'Boost (%) input should become visible').toBeVisible();

    await modal.oddsBoostCheckbox.uncheck();

    await expect(modal.oddsBoostPercentLabel, 'Boost (%) label should become absent again').toHaveCount(0);
  });

  test('Functional - Selecting "Cashed Out" as Result reveals the Cash Out Value field', async ({ page }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    await expect(modal.cashOutValueLabel, 'Cash Out Value label should be absent by default').toHaveCount(0);

    await modal.resultSelect.selectOption('Cashed Out');

    await expect(modal.cashOutValueLabel, 'Cash Out Value label should become visible').toBeVisible();
    await expect(modal.cashOutValueInput, 'Cash Out Value input should become visible').toBeVisible();

    await modal.resultSelect.selectOption('Open');

    await expect(modal.cashOutValueLabel, 'Cash Out Value label should become absent again').toHaveCount(0);
  });

  test('Functional - Odds format preference toggles between decimal input and fractional numerator/denominator inputs', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    const topBannerPage = new TopBannerPage(page);

    await betsPage.openAddBetModal();
    await expect(betsPage.addBetModal.oddsInput, 'Decimal odds input should be visible by default').toBeVisible();
    await expect(
      betsPage.addBetModal.oddsFractionalContainer,
      'Fractional odds container should be absent by default',
    ).toHaveCount(0);
    await betsPage.addBetModal.close();

    await topBannerPage.openUserMenu();
    await topBannerPage.toggleBetPreferences();
    await topBannerPage.oddsFormatSelect.selectOption('fractional');
    await topBannerPage.saveBetPreferences();
    await topBannerPage.closeUserMenuByClickingOutside();

    await betsPage.openAddBetModal();
    await expect(
      betsPage.addBetModal.oddsFractionalContainer,
      'Fractional odds container should become visible',
    ).toBeVisible();
    await expect(
      betsPage.addBetModal.oddsInput,
      'Decimal odds input should become absent',
    ).toHaveCount(0);
    await expect(betsPage.addBetModal.oddsNumeratorInput, 'Odds numerator input should default to 1').toHaveValue('1');
    await expect(betsPage.addBetModal.oddsDenominatorInput, 'Odds denominator input should default to 1').toHaveValue('1');
  });

  test('Functional - Submitting with invalid odds shows an inline error and does not close the modal', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    // Selecting a concrete fixture triggers GET /api/fixtures/:id/players
    // (useBetForm.ts's selectedFixtureId watcher) — wait for it to resolve
    // before interacting with the Market dropdown, otherwise selecting a
    // market and submitting can race the in-flight request.
    const playersPromise = waitForResponse(page, 'GET', '/players');
    await modal.fixtureSelect.selectOption({ index: 1 });
    await playersPromise;
    await modal.marketSelect.selectOption({ index: 1 });

    await modal.oddsInput.fill('');
    await modal.submit();

    await expect(modal.errorMessage, 'Form error message should become visible').toBeVisible();
    await expect(modal.errorMessage, 'Error message should mention valid decimal odds').toContainText(
      'valid decimal odds',
    );
    await expect(modal.modal, 'Modal should remain open').toBeVisible();
  });

  test('Functional - Successful submission with a concrete fixture shows the "Add another?" prompt; choosing "Yes" keeps the modal open, "No" closes it', async ({
    page,
  }) => {
    const betsPage = new BetsPage(page);
    await betsPage.openAddBetModal();
    const modal = betsPage.addBetModal;

    // Selecting a concrete fixture triggers GET /api/fixtures/:id/players
    // (useBetForm.ts's selectedFixtureId watcher) — wait for it to resolve
    // before interacting with the Market/Bookmaker dropdowns and submitting,
    // otherwise the submission can race the in-flight request.
    const playersPromise = waitForResponse(page, 'GET', '/players');
    await modal.fixtureSelect.selectOption({ index: 1 });
    await playersPromise;
    await modal.marketSelect.selectOption({ index: 1 });
    await modal.bookmakerSelect.selectOption({ index: 1 });

    const submitAndAwaitBet = () => waitForResponse(page, 'POST', '/api/bets');

    let betPostPromise = submitAndAwaitBet();
    await modal.submit();
    await betPostPromise;

    await expect(modal.addAnotherPrompt, '"Add another?" prompt should become visible').toBeVisible();
    await expect(modal.addAnotherHeading, 'Prompt heading should read "Add another?"').toHaveText('Add another?');
    await expect(
      modal.addAnotherText,
      'Prompt body text should describe repeating on the same fixture',
    ).toHaveText('Bet added successfully. Would you like to add another bet on the same fixture?');

    await modal.addAnotherYesButton.click();

    await expect(modal.addAnotherPrompt, 'Prompt should hide after choosing "Yes"').toHaveCount(0);
    await expect(modal.modal, 'Modal should remain open after choosing "Yes"').toBeVisible();
    await expect(modal.fixtureSelect, 'Fixture selection should be retained after choosing "Yes"').not.toHaveValue('');

    // Repeat the same submission fresh to test "No" independently.
    await modal.marketSelect.selectOption({ index: 1 });
    await modal.bookmakerSelect.selectOption({ index: 1 });
    betPostPromise = submitAndAwaitBet();
    await modal.submit();
    await betPostPromise;

    await expect(modal.addAnotherPrompt, '"Add another?" prompt should become visible again').toBeVisible();
    await modal.addAnotherNoButton.click();

    await expect(modal.addAnotherPrompt, 'Prompt should hide after choosing "No"').toHaveCount(0);
    await expect(modal.modal, 'Modal should close entirely after choosing "No"').toHaveCount(0);
  });
});


