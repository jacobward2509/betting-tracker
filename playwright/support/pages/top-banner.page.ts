import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the shared `TopBanner.vue` header and its three
 * exclusively-owned user-menu child components (`UserMenuDisplayName.vue`,
 * `UserMenuVisualPreferences.vue`, `UserMenuBetPreferences.vue`), rendered on
 * every authenticated route via `AppShellView.vue` — see
 * playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md. `TabNav.vue`
 * (a decoupled sibling in `AppShellView`) is deliberately out of scope here.
 */
export class TopBannerPage {
  readonly page: Page;

  // Header
  readonly topBanner: Locator;
  readonly appTitle: Locator;
  readonly appSubtext: Locator;
  readonly userMenuToggleButton: Locator;
  readonly userMenuDropdown: Locator;

  // Dropdown-level
  readonly signedInAsLabel: Locator;
  readonly signedInEmail: Locator;
  readonly unsavedChangesBanner: Locator;
  readonly signOutButton: Locator;

  // Display Name section
  readonly displayNameLabel: Locator;
  readonly displayNameText: Locator;
  readonly editDisplayNameButton: Locator;
  readonly displayNameInput: Locator;
  readonly saveDisplayNameButton: Locator;
  readonly cancelDisplayNameButton: Locator;
  readonly displayNameError: Locator;

  // Visual Preferences section
  readonly visualPreferenceLabel: Locator;
  readonly visualPreferencesToggle: Locator;
  readonly themeSelect: Locator;
  readonly saveVisualPreferencesButton: Locator;

  // Bet Preferences section
  readonly betPreferencesLabel: Locator;
  readonly betPreferencesToggle: Locator;
  readonly betPreferencesLoadingText: Locator;
  readonly oddsFormatSelect: Locator;
  readonly defaultBookmakerSelect: Locator;
  readonly defaultBetTypeSelect: Locator;
  readonly defaultStakeInput: Locator;
  readonly betPreferencesError: Locator;
  readonly saveBetPreferencesButton: Locator;

  static readonly EXPECTED_BOOKMAKERS = [
    'Bet365',
    'Betfair',
    'BetUK',
    'Ladbrokes',
    'Paddy Power',
    'SkyBet',
    'William Hill',
  ] as const;

  static readonly EXPECTED_BET_TYPES = [
    'Accumulator',
    'Bet Builder',
    'Player Prop',
    'Superboost',
    'FT Result',
    'Other',
  ] as const;

  static readonly DEFAULT_BOOKMAKER = 'Bet365';
  static readonly DEFAULT_BET_TYPE = 'Player Prop';
  static readonly DEFAULT_STAKE = '5';

  constructor(page: Page) {
    this.page = page;

    this.topBanner = page.getByTestId('top-banner');
    this.appTitle = this.topBanner.locator('h1');
    this.appSubtext = this.topBanner.locator('p').first();
    this.userMenuToggleButton = page.getByTestId('user-menu-toggle-button');
    this.userMenuDropdown = page.getByTestId('user-menu-dropdown');

    this.signedInAsLabel = this.userMenuDropdown.locator('p').first();
    this.signedInEmail = this.userMenuDropdown.locator('p').nth(1);
    this.unsavedChangesBanner = this.userMenuDropdown.getByText(
      'You have unsaved changes. If you close this menu without saving, they will be lost.',
    );
    this.signOutButton = page.getByTestId('user-menu-sign-out-button');

    this.displayNameLabel = this.userMenuDropdown.getByText('Display Name', { exact: true });
    this.displayNameText = page.getByTestId('user-menu-display-name');
    this.editDisplayNameButton = page.getByTestId('user-menu-edit-display-name-button');
    this.displayNameInput = page.getByTestId('user-menu-display-name-input');
    this.saveDisplayNameButton = page.getByTestId('user-menu-save-display-name-button');
    this.cancelDisplayNameButton = page.getByTestId('user-menu-cancel-display-name-button');
    this.displayNameError = page.getByTestId('user-menu-display-name-error');

    this.visualPreferenceLabel = this.userMenuDropdown.getByText('Visual Preference', { exact: true });
    this.visualPreferencesToggle = page.getByTestId('user-menu-visual-preferences-toggle');
    this.themeSelect = page.getByTestId('user-menu-theme-select');
    this.saveVisualPreferencesButton = page.getByTestId('user-menu-save-visual-preferences-button');

    this.betPreferencesLabel = this.userMenuDropdown.getByText('Bet Preferences', { exact: true });
    this.betPreferencesToggle = page.getByTestId('user-menu-bet-preferences-toggle');
    this.betPreferencesLoadingText = this.userMenuDropdown.getByText('Loading preferences...');
    this.oddsFormatSelect = page.getByTestId('user-menu-odds-format-select');
    this.defaultBookmakerSelect = page.getByTestId('user-menu-default-bookmaker-select');
    this.defaultBetTypeSelect = page.getByTestId('user-menu-default-bet-type-select');
    this.defaultStakeInput = page.getByTestId('user-menu-default-stake-input');
    this.betPreferencesError = page.getByTestId('user-menu-bet-preferences-error');
    this.saveBetPreferencesButton = page.getByTestId('user-menu-save-bet-preferences-button');
  }

  /** Lightweight smoke check: the header itself is visible. */
  async expectLoaded() {
    await expect(this.topBanner, 'Top banner should be visible').toBeVisible();
  }

  /** Maps a bookmaker's display label to the raw enum-value slug used in its data-test-id (e.g. "Paddy Power" -> "paddypower", "William Hill" -> "williamhill"), matching UserMenuBetPreferences.vue's own slugifyBookmaker() applied to the raw API enum value rather than the display label. */
  private slugifyBookmaker(bookmaker: string): string {
    return bookmaker
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  bookmakerCheckbox(bookmaker: string): Locator {
    return this.page.getByTestId(`user-menu-bookmaker-checkbox-${this.slugifyBookmaker(bookmaker)}`);
  }

  async openUserMenu() {
    await this.userMenuToggleButton.click();
  }

  /** Closes the dropdown by clicking an element outside it (the app title). */
  async closeUserMenuByClickingOutside() {
    await this.appTitle.click();
  }

  async signOut() {
    await this.signOutButton.click();
  }

  async startEditingDisplayName() {
    await this.editDisplayNameButton.click();
  }

  async fillDisplayNameInput(name: string) {
    await this.displayNameInput.fill(name);
  }

  async saveDisplayName() {
    await this.saveDisplayNameButton.click();
  }

  async cancelEditingDisplayName() {
    await this.cancelDisplayNameButton.click();
  }

  async toggleVisualPreferences() {
    await this.visualPreferencesToggle.click();
  }

  async selectTheme(theme: 'Light' | 'Dark') {
    await this.themeSelect.selectOption(theme);
  }

  async saveVisualPreferences() {
    await this.saveVisualPreferencesButton.click();
  }

  async toggleBetPreferences() {
    await this.betPreferencesToggle.click();
  }

  async toggleBookmaker(bookmaker: string) {
    await this.bookmakerCheckbox(bookmaker).click();
  }

  async selectDefaultBookmaker(bookmaker: string) {
    await this.defaultBookmakerSelect.selectOption(bookmaker);
  }

  async selectDefaultBetType(betType: string) {
    await this.defaultBetTypeSelect.selectOption(betType);
  }

  async fillDefaultStake(stake: string) {
    await this.defaultStakeInput.fill(stake);
  }

  async saveBetPreferences() {
    await this.saveBetPreferencesButton.click();
  }

  /** Cosmetic check for the static header (always visible, no menu interaction). */
  async expectHeaderCosmeticElements() {
    await expect(this.topBanner, 'Top banner should be visible').toBeVisible();
    await expect(this.appTitle, 'App title should read "Bets Tracker"').toHaveText('Bets Tracker');
    await expect(
      this.appSubtext,
      'App subtext should describe the P/L tracking purpose',
    ).toHaveText('The go-to site to track your betting Profit and Loss across all bookmakers.');
    await expect(this.userMenuToggleButton, 'User menu toggle button should be visible').toBeVisible();
    await expect(this.userMenuDropdown, 'User menu dropdown should be absent from the DOM by default').toHaveCount(0);
  }

  /** Cosmetic check for the dropdown-level elements (signed-in email, hidden banner, sign out) once opened. */
  async expectDropdownCosmeticElements(expectedEmail: string) {
    await expect(this.userMenuDropdown, 'User menu dropdown should be visible').toBeVisible();
    await expect(this.signedInAsLabel, 'Signed-in-as label should read "Signed in as"').toHaveText('Signed in as');
    await expect(this.signedInEmail, `Signed-in email should read "${expectedEmail}"`).toHaveText(expectedEmail);
    await expect(this.unsavedChangesBanner, 'Unsaved changes banner should be absent by default').toHaveCount(0);
    await expect(this.signOutButton, 'Sign Out button should be visible').toBeVisible();
    await expect(this.signOutButton, 'Sign Out button should be enabled').toBeEnabled();
  }

  /** Cosmetic check for the Display Name section in its default (view) mode. */
  async expectDisplayNameViewModeCosmeticElements(expectedName: string) {
    await expect(this.displayNameLabel, 'Display Name label should be visible').toBeVisible();
    await expect(this.displayNameText, `Display name should read "${expectedName}"`).toHaveText(expectedName);
    await expect(this.editDisplayNameButton, 'Edit button should be visible').toBeVisible();
    await expect(this.displayNameInput, 'Display name input should not be present in view mode').toHaveCount(0);
  }

  /** Cosmetic check for the Visual Preference section collapsed by default. */
  async expectVisualPreferencesCollapsedCosmeticElements() {
    await expect(this.visualPreferenceLabel, 'Visual Preference label should be visible').toBeVisible();
    await expect(this.visualPreferencesToggle, 'Visual Preferences toggle should read "Configure"').toHaveText(
      'Configure',
    );
    await expect(this.themeSelect, 'Theme select should not be present while collapsed').toHaveCount(0);
  }

  /** Cosmetic check for the Bet Preferences section collapsed by default. */
  async expectBetPreferencesCollapsedCosmeticElements() {
    await expect(this.betPreferencesLabel, 'Bet Preferences label should be visible').toBeVisible();
    await expect(this.betPreferencesToggle, 'Bet Preferences toggle should read "Configure"').toHaveText('Configure');
    await expect(this.oddsFormatSelect, 'Odds format select should not be present while collapsed').toHaveCount(0);
  }
}


