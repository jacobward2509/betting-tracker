import { Page, Locator, expect } from '@playwright/test';

/**
 * Component object for the shared multi-leg editor (`BetLegsEditor.vue`),
 * used by Accumulator / Bet Builder / Cross Match Bet Builder bet types on
 * both the Add Bet modal and (in a future plan) the Edit Bet modal — split
 * out per playwright/docs/test-plans/ui/bets/ui-test-plan-add-bet.md.
 * Composed into `AddBetModalComponent` via `readonly legsEditor`.
 */
export class BetLegsEditorComponent {
  readonly page: Page;

  readonly betBuilderFixtureLabel: Locator;
  readonly betBuilderFixtureSelect: Locator;
  readonly addLegButton: Locator;
  readonly rulesMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.betBuilderFixtureLabel = page.getByTestId('bet-builder-fixture-label');
    this.betBuilderFixtureSelect = page.getByTestId('input-bet-builder-fixture');
    this.addLegButton = page.getByTestId('add-bet-leg');
    this.rulesMessage = page.getByTestId('bet-legs-rule-message');
  }

  leg(index: number): Locator {
    return this.page.getByTestId(`bet-leg-${index}`);
  }

  legFixtureLabel(index: number): Locator {
    return this.page.getByTestId(`bet-leg-fixture-label-${index}`);
  }

  legFixtureSelect(index: number): Locator {
    return this.page.getByTestId(`input-bet-leg-fixture-${index}`);
  }

  legFixtureConflictMessage(index: number): Locator {
    return this.page.getByTestId(`bet-leg-fixture-conflict-${index}`);
  }

  legMarketLabel(index: number): Locator {
    return this.page.getByTestId(`bet-leg-market-label-${index}`);
  }

  legMarketSelect(index: number): Locator {
    return this.page.getByTestId(`input-bet-leg-market-${index}`);
  }

  legPlayerLabel(index: number): Locator {
    return this.page.getByTestId(`bet-leg-player-label-${index}`);
  }

  legPlayerSelect(index: number): Locator {
    return this.page.getByTestId(`input-bet-leg-player-${index}`);
  }

  legSelectionLabel(index: number): Locator {
    return this.page.getByTestId(`bet-leg-selection-label-${index}`);
  }

  legSelectionSelect(index: number): Locator {
    return this.page.getByTestId(`input-bet-leg-selection-${index}`);
  }

  legSelectionLineSelect(index: number): Locator {
    return this.page.getByTestId(`input-bet-leg-selection-line-${index}`);
  }

  removeLegButton(index: number): Locator {
    return this.page.getByTestId(`remove-bet-leg-${index}`);
  }

  async addLeg() {
    await this.addLegButton.click();
  }

  async removeLeg(index: number) {
    await this.removeLegButton(index).click();
  }

  async expectLegCount(count: number) {
    await expect(
      this.page.locator('[data-test-id^="bet-leg-"]:not([data-test-id*="-label-"]):not([data-test-id*="-conflict-"])'),
      `${count} leg(s) should be rendered`,
    ).toHaveCount(count);
  }
}
