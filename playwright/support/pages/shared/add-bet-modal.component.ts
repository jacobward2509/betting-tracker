import { Page, Locator, expect } from '@playwright/test';
import { BetLegsEditorComponent } from './bet-legs-editor.component';

/**
 * Component object for the Add Bet modal (`AddBetModal.vue`) — split out of
 * `BetsPage` per playwright/docs/test-plans/ui/bets/ui-test-plan-add-bet.md.
 * Composed into `BetsPage` via `readonly addBetModal`. `AddBetModal.vue` and
 * the future Edit Bet modal share ~90% of their fields via the
 * `useBetForm` composable and the same `BetLegsEditor.vue` component
 * (exposed here via `readonly legsEditor`) — Edit Bet's own modal remains a
 * future dedicated plan/page-object extension (its fields use an
 * `edit-` prefixed `data-test-id`, e.g. `edit-input-date`, so there is no
 * locator collision between the two modals).
 */
export class AddBetModalComponent {
  readonly page: Page;

  readonly modal: Locator;
  readonly heading: Locator;
  readonly closeButton: Locator;
  readonly form: Locator;

  readonly dateLabel: Locator;
  readonly dateInput: Locator;

  readonly betTypeLabel: Locator;
  readonly betTypeSelect: Locator;

  readonly otherBetTypeLabel: Locator;
  readonly otherBetTypeInput: Locator;

  readonly legsLabel: Locator;
  readonly legsEditor: BetLegsEditorComponent;

  readonly fixtureLabel: Locator;
  readonly fixtureSelect: Locator;
  readonly homeTeamInput: Locator;
  readonly awayTeamInput: Locator;

  readonly marketLabel: Locator;
  readonly marketSelect: Locator;

  readonly playerLabel: Locator;
  readonly playerSelect: Locator;
  readonly playerManualInput: Locator;

  readonly selectionLabel: Locator;
  readonly selectionSelect: Locator;
  readonly selectionLineSelect: Locator;

  readonly bookmakerLabel: Locator;
  readonly bookmakerSelect: Locator;

  readonly stakeTypeLabel: Locator;
  readonly stakeTypeSelect: Locator;

  readonly stakeLabel: Locator;
  readonly stakeInput: Locator;
  readonly normalStakeLabel: Locator;
  readonly normalStakeInput: Locator;
  readonly freeStakeLabel: Locator;
  readonly freeStakeInput: Locator;

  readonly oddsLabel: Locator;
  readonly oddsInput: Locator;
  readonly oddsFractionalContainer: Locator;
  readonly oddsNumeratorInput: Locator;
  readonly oddsDenominatorInput: Locator;

  readonly oddsBoostLabel: Locator;
  readonly oddsBoostCheckbox: Locator;
  readonly oddsBoostPercentLabel: Locator;
  readonly oddsBoostPercentInput: Locator;

  readonly resultLabel: Locator;
  readonly resultSelect: Locator;
  readonly cashOutValueLabel: Locator;
  readonly cashOutValueInput: Locator;

  readonly errorMessage: Locator;
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  readonly addAnotherPrompt: Locator;
  readonly addAnotherHeading: Locator;
  readonly addAnotherText: Locator;
  readonly addAnotherNoButton: Locator;
  readonly addAnotherYesButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.modal = page.getByTestId('add-bet-modal');
    this.heading = page.getByTestId('add-bet-modal-heading');
    this.closeButton = page.getByTestId('add-bet-modal-close-button');
    this.form = page.getByTestId('add-bet-form');

    this.dateLabel = page.getByTestId('add-bet-date-label');
    this.dateInput = page.getByTestId('input-date');

    this.betTypeLabel = page.getByTestId('add-bet-type-label');
    this.betTypeSelect = page.getByTestId('input-bet-type');

    this.otherBetTypeLabel = page.getByTestId('add-other-bet-type-label');
    this.otherBetTypeInput = page.getByTestId('input-other-bet-type');

    this.legsLabel = page.getByTestId('add-bet-legs-label');
    this.legsEditor = new BetLegsEditorComponent(page);

    this.fixtureLabel = page.getByTestId('add-bet-fixture-label');
    this.fixtureSelect = page.getByTestId('input-fixture');
    this.homeTeamInput = page.getByTestId('input-home-team');
    this.awayTeamInput = page.getByTestId('input-away-team');

    this.marketLabel = page.getByTestId('add-bet-market-label');
    this.marketSelect = page.getByTestId('input-player-prop-market');

    this.playerLabel = page.getByTestId('add-bet-player-label');
    this.playerSelect = page.getByTestId('input-player');
    this.playerManualInput = page.getByTestId('input-player-manual');

    this.selectionLabel = page.getByTestId('add-bet-selection-label');
    this.selectionSelect = page.getByTestId('input-player-prop-selection');
    this.selectionLineSelect = page.getByTestId('input-player-prop-selection-line');

    this.bookmakerLabel = page.getByTestId('add-bet-bookmaker-label');
    this.bookmakerSelect = page.getByTestId('input-bookmaker');

    this.stakeTypeLabel = page.getByTestId('add-bet-stake-type-label');
    this.stakeTypeSelect = page.getByTestId('input-stake-type');

    this.stakeLabel = page.getByTestId('add-bet-stake-label');
    this.stakeInput = page.getByTestId('input-stake');
    this.normalStakeLabel = page.getByTestId('add-bet-normal-stake-label');
    this.normalStakeInput = page.getByTestId('input-normal-stake');
    this.freeStakeLabel = page.getByTestId('add-bet-free-stake-label');
    this.freeStakeInput = page.getByTestId('input-free-stake');

    this.oddsLabel = page.getByTestId('add-bet-odds-label');
    this.oddsInput = page.getByTestId('input-odds');
    this.oddsFractionalContainer = page.getByTestId('input-odds-fractional');
    this.oddsNumeratorInput = page.getByTestId('input-odds-numerator');
    this.oddsDenominatorInput = page.getByTestId('input-odds-denominator');

    this.oddsBoostLabel = page.getByTestId('add-bet-odds-boost-label');
    this.oddsBoostCheckbox = page.getByTestId('input-odds-boost-checkbox');
    this.oddsBoostPercentLabel = page.getByTestId('add-bet-odds-boost-percent-label');
    this.oddsBoostPercentInput = page.getByTestId('input-odds-boost-percent');

    this.resultLabel = page.getByTestId('add-bet-result-label');
    this.resultSelect = page.getByTestId('input-result');
    this.cashOutValueLabel = page.getByTestId('add-bet-cash-out-value-label');
    this.cashOutValueInput = page.getByTestId('input-cash-out-value');

    this.errorMessage = page.getByTestId('add-bet-error');
    this.cancelButton = page.getByTestId('cancel-add-bet');
    this.submitButton = page.getByTestId('submit-add-bet');

    this.addAnotherPrompt = page.getByTestId('add-another-bet-prompt');
    this.addAnotherHeading = page.getByTestId('add-another-bet-heading');
    this.addAnotherText = page.getByTestId('add-another-bet-text');
    this.addAnotherNoButton = page.getByTestId('add-another-bet-no-button');
    this.addAnotherYesButton = page.getByTestId('add-another-bet-yes-button');
  }

  async close() {
    await this.closeButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectVisible() {
    await expect(this.modal, 'Add Bet modal should be visible').toBeVisible();
  }

  async expectHidden() {
    await expect(this.modal, 'Add Bet modal should be absent from the DOM').toHaveCount(0);
  }

  /** Cosmetic check for the modal's default (Player Prop) rendered state, once opened. */
  async expectDefaultCosmeticElements() {
    await expect(this.modal, 'Add Bet modal should be visible').toBeVisible();
    await expect(this.heading, 'Heading should read "Add New Bet"').toHaveText('Add New Bet');
    await expect(this.closeButton, 'Close button should be visible').toBeVisible();

    await expect(this.dateLabel, 'Date label should be visible').toBeVisible();
    await expect(this.dateInput, 'Date input should default to today').toHaveValue(
      new Date().toISOString().slice(0, 10),
    );

    await expect(this.betTypeLabel, 'Bet Type label should be visible').toBeVisible();
    await expect(
      this.betTypeSelect,
      'Bet Type should default to "Player Prop" for a brand-new account',
    ).toHaveValue('Player Prop');

    await expect(this.bookmakerLabel, 'Bookmaker label should be visible').toBeVisible();
    await expect(this.bookmakerSelect, 'Bookmaker should have no saved default selected').toHaveValue('');

    await expect(this.stakeTypeLabel, 'Stake Type label should be visible').toBeVisible();
    await expect(this.stakeTypeSelect, 'Stake Type should default to "Normal"').toHaveValue('Normal');

    await expect(this.oddsBoostLabel, 'Odds Boost label should be visible').toBeVisible();
    await expect(this.oddsBoostCheckbox, 'Odds Boost checkbox should be unchecked by default').not.toBeChecked();

    await expect(this.resultLabel, 'Result label should be visible').toBeVisible();
    await expect(this.resultSelect, 'Result should default to "Open"').toHaveValue('Open');

    // Player Prop (default bet type) fields.
    await expect(
      this.fixtureLabel,
      'Fixture label should be visible for the default Player Prop bet type',
    ).toBeVisible();
    await expect(this.fixtureSelect, 'Fixture select should be visible').toBeVisible();

    await expect(this.stakeLabel, 'Stake label should be visible').toBeVisible();
    await expect(this.stakeInput, 'Stake should default to 5').toHaveValue('5');

    await expect(this.oddsLabel, 'Odds label should be visible').toBeVisible();
    await expect(this.oddsInput, 'Decimal odds input should default to "2"').toHaveValue('2');

    await expect(this.cancelButton, 'Cancel button should be visible').toBeVisible();
    await expect(this.cancelButton, 'Cancel button should be enabled').toBeEnabled();
    await expect(this.submitButton, 'Add Bet submit button should be visible').toBeVisible();
    await expect(this.submitButton, 'Add Bet submit button should be enabled').toBeEnabled();

    // Conditionally-hidden elements absent by default.
    await expect(this.otherBetTypeInput, 'Other Bet Type input should be absent by default').toHaveCount(0);
    await expect(this.legsLabel, 'Legs label should be absent by default').toHaveCount(0);
    await expect(this.marketLabel, 'Market label should be absent before a fixture is selected').toHaveCount(0);
    await expect(this.playerLabel, 'Player label should be absent by default').toHaveCount(0);
    await expect(this.selectionLabel, 'Selection label should be absent by default').toHaveCount(0);
    await expect(this.cashOutValueLabel, 'Cash Out Value label should be absent by default').toHaveCount(0);
    await expect(this.oddsBoostPercentLabel, 'Boost percent label should be absent by default').toHaveCount(0);
    await expect(this.normalStakeLabel, 'Normal Stake label should be absent by default').toHaveCount(0);
    await expect(this.freeStakeLabel, 'Free Stake label should be absent by default').toHaveCount(0);
    await expect(this.errorMessage, 'Form error message should be absent by default').toHaveCount(0);
    await expect(this.addAnotherPrompt, 'Add another prompt should be absent by default').toHaveCount(0);
  }

  /**
   * Cosmetic check for the Bet Type dropdown's default value and full
   * option list — merged with FALLBACK_BET_TYPES (useBetForm.ts), so a
   * brand-new account's GET /api/bet-types response plus any fallback
   * entries not already present must offer every fallback type at minimum.
   */
  async expectBetTypeOptions() {
    await expect(this.betTypeSelect, 'Bet Type should default to "Player Prop"').toHaveValue('Player Prop');

    const optionTexts = await this.betTypeSelect.locator('option:not([value=""])').allTextContents();
    for (const expectedType of [
      'Accumulator',
      'Bet Builder',
      'Cross Match Bet Builder',
      'Match',
      'Player Prop',
      'Superboost',
      'Other',
    ]) {
      expect(optionTexts, `Bet Type dropdown should offer "${expectedType}"`).toContain(expectedType);
    }
  }
}

