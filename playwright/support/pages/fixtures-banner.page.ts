import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the shared AnimatedFixturesBanner component, rendered
 * identically on `/sign-in` and `/sign-up` — see
 * playwright/docs/test-plans/ui/fixtures/ui-test-plan-fixtures-banner.md.
 * The banner is entirely absent from the DOM (not merely hidden) whenever
 * `GET /api/fixtures/today` returns an empty array or fails, so most
 * expectations here are phrased in terms of element counts rather than
 * visibility alone.
 */
export class FixturesBannerPage {
  readonly page: Page;

  readonly bannerContainer: Locator;
  readonly fixtureRows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.bannerContainer = page.getByTestId('fixtures-banner');
    this.fixtureRows = this.bannerContainer.getByTestId('fixture-row');
  }

  /** Mocks GET /api/fixtures/today to return the given fixtures array (or an error status). */
  async mockFixtures(fixtures: unknown[]) {
    await this.page.route('**/api/fixtures/today', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures) });
    });
  }

  /** Mocks GET /api/fixtures/today to fail with the given status (default 500). */
  async mockFixturesFailure(status = 500) {
    await this.page.route('**/api/fixtures/today', async (route) => {
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Internal error' }) });
    });
  }

  /** Scopes to the row matching the given fixture's matchup text ("{homeTeam} v {awayTeam}"). */
  rowFor(homeTeam: string, awayTeam: string): Locator {
    return this.fixtureRows.filter({ has: this.page.getByTestId('fixture-matchup').getByText(`${homeTeam} v ${awayTeam}`, { exact: true }) });
  }

  leagueBadgeFor(homeTeam: string, awayTeam: string): Locator {
    return this.rowFor(homeTeam, awayTeam).getByTestId('fixture-league-badge');
  }

  matchupFor(homeTeam: string, awayTeam: string): Locator {
    return this.rowFor(homeTeam, awayTeam).getByTestId('fixture-matchup');
  }

  kickoffTimeFor(homeTeam: string, awayTeam: string): Locator {
    return this.rowFor(homeTeam, awayTeam).getByTestId('fixture-kickoff-time');
  }

  /** Asserts the banner and root container have zero elements in the DOM (not merely hidden). */
  async expectAbsent() {
    await expect(this.bannerContainer, 'Fixtures banner should have zero elements in the DOM').toHaveCount(0);
  }

  /** Asserts the banner is visible and contains the given fixture with correct league/matchup/kickoff-time content. */
  async expectFixtureVisible(fixture: { league: string; homeTeam: string; awayTeam: string }) {
    await expect(this.bannerContainer, 'Fixtures banner should be visible').toBeVisible();
    await expect(
      this.leagueBadgeFor(fixture.homeTeam, fixture.awayTeam).first(),
      `League badge for ${fixture.homeTeam} v ${fixture.awayTeam} should show "${fixture.league}"`,
    ).toHaveText(fixture.league);
    await expect(
      this.matchupFor(fixture.homeTeam, fixture.awayTeam).first(),
      `Matchup text should read "${fixture.homeTeam} v ${fixture.awayTeam}"`,
    ).toHaveText(`${fixture.homeTeam} v ${fixture.awayTeam}`);
    await expect(
      this.kickoffTimeFor(fixture.homeTeam, fixture.awayTeam).first(),
      `Kickoff time for ${fixture.homeTeam} v ${fixture.awayTeam} should be non-empty`,
    ).not.toBeEmpty();
  }
}
