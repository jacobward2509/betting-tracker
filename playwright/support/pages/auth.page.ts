import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for AuthView (`/auth`), covering both its `login` mode (per
 * `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-login.md`) and its
 * `signup` mode (per
 * `playwright/docs/test-plans/ui/auth/ui-test-plan-auth-signup.md`). The
 * component defaults to `login` mode; use `toggleMode()` to reach `signup`.
 */
export class AuthPage {
  readonly page: Page;

  readonly authForm: Locator;
  readonly authHeading: Locator;
  readonly authSubtext: Locator;

  readonly nameLabel: Locator;
  readonly nameInput: Locator;
  readonly nameError: Locator;

  readonly preferencesHeading: Locator;
  readonly preferencesHelperText: Locator;
  readonly togglePreferencesButton: Locator;
  readonly preferencesFooterNote: Locator;

  readonly defaultBookmakerLabel: Locator;
  readonly defaultBookmakerSelect: Locator;
  readonly defaultBetTypeLabel: Locator;
  readonly defaultBetTypeSelect: Locator;
  readonly defaultStakeLabel: Locator;
  readonly defaultStakeInput: Locator;

  readonly emailLabel: Locator;
  readonly emailInput: Locator;
  readonly emailError: Locator;

  readonly passwordLabel: Locator;
  readonly passwordInput: Locator;
  readonly togglePasswordVisibilityButton: Locator;
  readonly passwordError: Locator;
  readonly passwordHelperText: Locator;

  readonly authErrorMessage: Locator;
  readonly submitButton: Locator;
  readonly toggleModeButton: Locator;

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
  static readonly SIGNUP_PASSWORD_MIN_LENGTH = 10;

  constructor(page: Page) {
    this.page = page;

    this.authForm = page.getByTestId('auth-form');
    this.authHeading = page.getByTestId('auth-heading');
    this.authSubtext = page.getByTestId('auth-subtext');

    this.nameLabel = page.getByTestId('name-label');
    this.nameInput = page.getByTestId('name-input');
    this.nameError = page.getByTestId('name-error');

    this.preferencesHeading = page.getByTestId('preferences-heading');
    this.preferencesHelperText = page.getByTestId('preferences-helper-text');
    this.togglePreferencesButton = page.getByTestId('toggle-preferences-button');
    this.preferencesFooterNote = page.getByTestId('preferences-footer-note');

    this.defaultBookmakerLabel = page.getByTestId('default-bookmaker-label');
    this.defaultBookmakerSelect = page.getByTestId('default-bookmaker-select');
    this.defaultBetTypeLabel = page.getByTestId('default-bet-type-label');
    this.defaultBetTypeSelect = page.getByTestId('default-bet-type-select');
    this.defaultStakeLabel = page.getByTestId('default-stake-label');
    this.defaultStakeInput = page.getByTestId('default-stake-input');

    this.emailLabel = page.getByTestId('email-label');
    this.emailInput = page.getByTestId('email-input');
    this.emailError = page.getByTestId('email-error');

    this.passwordLabel = page.getByTestId('password-label');
    this.passwordInput = page.getByTestId('password-input');
    this.togglePasswordVisibilityButton = page.getByTestId('toggle-password-visibility-button');
    this.passwordError = page.getByTestId('password-error');
    this.passwordHelperText = page.getByTestId('password-helper-text');

    this.authErrorMessage = page.getByTestId('auth-error-message');
    this.submitButton = page.getByTestId('submit-button');
    this.toggleModeButton = page.getByTestId('toggle-mode-button');
  }

  /** Bookmaker checkbox locator for a given bookmaker name (e.g. `AuthPage.EXPECTED_BOOKMAKERS[0]`). */
  bookmakerCheckbox(bookmaker: string): Locator {
    return this.page.getByTestId(`bookmaker-checkbox-${bookmaker}`);
  }

  async goto() {
    await this.page.goto('/auth');
  }

  /** Switches the form between login and signup mode (toggles whichever mode isn't currently active). */
  async toggleMode() {
    await this.toggleModeButton.click();
  }

  async togglePreferences() {
    await this.togglePreferencesButton.click();
  }

  async toggleBookmaker(bookmaker: string) {
    await this.bookmakerCheckbox(bookmaker).click();
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async fillDefaultStake(stake: string) {
    await this.defaultStakeInput.fill(stake);
  }

  async togglePasswordVisibility() {
    await this.togglePasswordVisibilityButton.click();
  }

  async selectDefaultBookmaker(bookmaker: string) {
    await this.defaultBookmakerSelect.selectOption(bookmaker);
  }

  async selectDefaultBetType(betType: string) {
    await this.defaultBetTypeSelect.selectOption(betType);
  }

  async submit() {
    await this.submitButton.click();
  }

  /** Fills the Name, Email, and Password fields and submits — the minimum required fields for signup. */
  async submitSignupForm({ name, email, password }: { name: string; email: string; password: string }) {
    await this.fillName(name);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /** Fills the Email and Password fields and submits — the required fields for login. */
  async submitLoginForm({ email, password }: { email: string; password: string }) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /** Lightweight smoke check: URL and one defining locator. Mode-agnostic — does not assume signup mode. */
  async expectLoaded() {
    await expect(this.page, 'Auth page URL should be /auth').toHaveURL(/\/auth/);
    await expect(this.authForm, 'Auth form should be visible').toBeVisible();
  }

  /** Cosmetic check for the heading/subtext component only. Exact wording differs per mode and is asserted by the caller. */
  async expectHeadingCosmeticElements() {
    await expect(this.authHeading, 'Auth heading should be visible').toBeVisible();
    await expect(this.authSubtext, 'Auth subtext should be visible').toBeVisible();
  }

  /** Cosmetic check for the Name field component only (signup mode). */
  async expectNameFieldCosmeticElements() {
    await expect(this.nameLabel, 'Name label should be visible').toBeVisible();
    await expect(this.nameLabel, 'Name label should read "Name"').toHaveText('Name');
    await expect(this.nameInput, 'Name input should be empty by default').toBeEmpty();
    await expect(this.nameError, 'Name error should be hidden by default').toBeHidden();
  }

  /** Cosmetic check for the Email field component only. */
  async expectEmailFieldCosmeticElements() {
    await expect(this.emailLabel, 'Email label should read "Email"').toHaveText('Email');
    await expect(this.emailInput, 'Email input should be empty by default').toBeEmpty();
    await expect(this.emailInput, 'Email input should have no placeholder attribute').not.toHaveAttribute(
      'placeholder',
    );
    await expect(this.emailError, 'Email error should be hidden by default').toBeHidden();
  }

  /** Cosmetic check for the Password field component only. Signup mode's helper text is asserted separately by the caller. */
  async expectPasswordFieldCosmeticElements() {
    await expect(this.passwordLabel, 'Password label should read "Password"').toHaveText('Password');
    await expect(this.passwordInput, 'Password input should be empty by default').toBeEmpty();
    await expect(this.passwordInput, 'Password input should have no placeholder attribute').not.toHaveAttribute(
      'placeholder',
    );
    await expect(this.passwordError, 'Password error should be hidden by default').toBeHidden();
  }

  /** Cosmetic check for the Submit button component only. Exact wording differs per mode and is asserted by the caller. */
  async expectSubmitButtonCosmeticElements() {
    await expect(this.submitButton, 'Submit button should be visible').toBeVisible();
    await expect(this.submitButton, 'Submit button should be enabled').toBeEnabled();
  }

  /** Cosmetic check for the mode-toggle button component only. `expectedText` differs between login and signup mode. */
  async expectToggleModeButtonCosmeticElements(expectedText: string) {
    await expect(this.toggleModeButton, 'Mode toggle button should be visible').toBeVisible();
    await expect(this.toggleModeButton, `Mode toggle button should read "${expectedText}"`).toHaveText(expectedText);
  }

  /** Cosmetic check for the Auth error message component only. */
  async expectAuthErrorMessageCosmeticElements() {
    await expect(this.authErrorMessage, 'Auth error message should be hidden by default').toBeHidden();
  }

  /** Cosmetic check confirming signup-only elements are absent from the DOM while in login mode. */
  async expectSignupOnlyElementsAbsentInLoginMode() {
    await expect(this.nameInput, 'Name input should not be present in the DOM in login mode').toHaveCount(0);
    await expect(
      this.preferencesHeading,
      'Betting Preferences heading should not be present in the DOM in login mode',
    ).toHaveCount(0);
    await expect(
      this.passwordHelperText,
      'Password helper text should not be present in the DOM in login mode',
    ).toHaveCount(0);
  }
}
