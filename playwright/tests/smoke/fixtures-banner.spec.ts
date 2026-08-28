import { test, expect } from '@playwright/test';
import { AuthPage } from '@pages/auth.page';
import { FixturesBannerPage } from '@pages/fixtures-banner.page';

// The banner is rendered on the logged-out sign-in/sign-up pages, so these
// tests must start logged out regardless of the project's default
// storageState (see playwright-ui-test-generation.md §4).
test.use({ storageState: { cookies: [], origins: [] } });

const MOCK_FIXTURES = [
  {
    id: 'fixture-1',
    league: 'PREMIER_LEAGUE',
    homeTeam: 'Crystal Palace',
    awayTeam: 'Manchester City',
    kickoffAt: '2026-08-28T19:00:00.000Z',
    venue: 'Selhurst Park',
  },
  {
    id: 'fixture-2',
    league: 'LA_LIGA',
    homeTeam: 'Racing de Santander',
    awayTeam: 'Elche',
    kickoffAt: '2026-08-28T17:00:00.000Z',
    venue: 'Campos de Sport de El Sardinero',
  },
];

test.describe('Fixtures Banner', () => {
  test('Cosmetic - Banner renders fixture content correctly when fixtures are returned', async ({ page }) => {
    const bannerPage = new FixturesBannerPage(page);
    await bannerPage.mockFixtures(MOCK_FIXTURES);

    const authPage = new AuthPage(page);
    await authPage.goto('login');

    for (const fixture of MOCK_FIXTURES) {
      await bannerPage.expectFixtureVisible({
        league: fixture.league === 'PREMIER_LEAGUE' ? 'Premier League' : 'La Liga',
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
      });
    }
  });

  test('Cosmetic - Banner is absent from the DOM when no fixtures are returned', async ({ page }) => {
    const bannerPage = new FixturesBannerPage(page);
    await bannerPage.mockFixtures([]);

    const authPage = new AuthPage(page);
    await authPage.goto('login');

    await bannerPage.expectAbsent();
  });

  test('Cosmetic - Banner renders identically on the sign-up page', async ({ page }) => {
    const bannerPage = new FixturesBannerPage(page);
    await bannerPage.mockFixtures(MOCK_FIXTURES);

    const authPage = new AuthPage(page);
    await authPage.goto('signup');

    for (const fixture of MOCK_FIXTURES) {
      await bannerPage.expectFixtureVisible({
        league: fixture.league === 'PREMIER_LEAGUE' ? 'Premier League' : 'La Liga',
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
      });
    }
  });

  test('Cosmetic - Each fixture is duplicated for the seamless marquee loop', async ({ page }) => {
    const singleFixture = [MOCK_FIXTURES[0]];
    const bannerPage = new FixturesBannerPage(page);
    await bannerPage.mockFixtures(singleFixture);

    const authPage = new AuthPage(page);
    await authPage.goto('login');

    await expect(bannerPage.bannerContainer, 'Fixtures banner should be visible').toBeVisible();
    await expect(
      bannerPage.rowFor(singleFixture[0].homeTeam, singleFixture[0].awayTeam),
      'Fixture row for the mocked fixture should appear exactly twice (marquee duplication)',
    ).toHaveCount(2);
    await expect(
      bannerPage.matchupFor(singleFixture[0].homeTeam, singleFixture[0].awayTeam),
      'Matchup text for the mocked fixture should appear exactly twice (marquee duplication)',
    ).toHaveCount(2);
  });
});
