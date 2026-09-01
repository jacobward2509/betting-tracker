import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the shared `TabNav.vue` tab-navigation bar, rendered on
 * every authenticated route via `AppShellView.vue` — see
 * playwright/docs/test-plans/ui/shell/ui-test-plan-tab-nav.md. Decoupled
 * sibling of `TopBanner.vue` (see `TopBannerPage` in `top-banner.page.ts`),
 * which is deliberately out of scope here.
 */
export class TabNavPage {
  readonly page: Page;

  readonly tabNav: Locator;
  readonly betsTab: Locator;
  readonly overallStatsTab: Locator;

  static readonly ACTIVE_CLASS = /border-blue-600 text-blue-600 dark:text-blue-400/;
  static readonly INACTIVE_CLASS =
    /border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white/;

  constructor(page: Page) {
    this.page = page;

    this.tabNav = page.getByTestId('tab-nav');
    this.betsTab = page.getByTestId('tab-nav-bets');
    this.overallStatsTab = page.getByTestId('tab-nav-overall-stats');
  }

  async clickBetsTab() {
    await this.betsTab.click();
  }

  async clickOverallStatsTab() {
    await this.overallStatsTab.click();
  }

  /** Cosmetic check for the tab nav bar as a whole: container visibility, both tabs' visibility/text, and which tab is active. */
  async expectCosmeticElements(activeTab: 'bets' | 'overallStats') {
    await expect(this.tabNav, 'Tab nav container should be visible').toBeVisible();
    await expect(this.betsTab, 'Bets tab should be visible').toBeVisible();
    await expect(this.betsTab, 'Bets tab should read "Bets"').toHaveText('Bets');
    await expect(this.overallStatsTab, 'Overall Stats tab should be visible').toBeVisible();
    await expect(this.overallStatsTab, 'Overall Stats tab should read "Overall Stats"').toHaveText('Overall Stats');
    await this.expectActiveTab(activeTab);
  }

  /** Asserts which tab currently carries the active styling classes vs. the inactive classes — reused by both the Cosmetic check and the post-navigation Navigation checks. */
  async expectActiveTab(activeTab: 'bets' | 'overallStats') {
    if (activeTab === 'bets') {
      await expect(this.betsTab, 'Bets tab should carry the active classes').toHaveClass(TabNavPage.ACTIVE_CLASS);
      await expect(
        this.overallStatsTab,
        'Overall Stats tab should carry the inactive classes',
      ).toHaveClass(TabNavPage.INACTIVE_CLASS);
    } else {
      await expect(
        this.overallStatsTab,
        'Overall Stats tab should carry the active classes',
      ).toHaveClass(TabNavPage.ACTIVE_CLASS);
      await expect(this.betsTab, 'Bets tab should carry the inactive classes').toHaveClass(TabNavPage.INACTIVE_CLASS);
    }
  }
}
