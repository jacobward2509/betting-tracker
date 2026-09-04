# UI Test Plan — Add Bet (`AddBetModal.vue`)

## Page Information

- **Component:** `AddBetModal.vue`, a modal rendered by `BetsView.vue` (`/bets`) and
  opened via the "Add Bet" button (already covered as a shared landmark in
  `ui-test-plan-bets-row-selection-bulk-actions.md`'s `BetsPage.addBetButton`, and as
  a post-navigation landmark in the auth signup/login plans). This was previously
  marked out of scope in `ui-test-plan-bets-summary-filters.md`,
  `ui-test-plan-bets-table-display.md`, and
  `ui-test-plan-bets-row-selection-bulk-actions.md` — this is that future dedicated
  plan. Edit Bet (`EditBetModal.vue`) — which shares ~90% of its fields with this
  modal via the shared `useBetForm` composable — remains its own future dedicated
  plan, referenced not re-documented here.
- **URL Pattern:** `/bets` (the modal renders in-place as an overlay; no URL change
  occurs on open or close).
- **Description:** A modal form for logging a new bet, backed by the shared
  `useBetForm` composable (`apps/web/src/composables/useBetForm.ts`, also used by the
  future Edit Bet plan). On open it prefills Bookmaker/Bet Type/Stake from the
  user's saved defaults (`GET /api/user/config`) and fetches Bookmakers
  (`GET /api/bookmakers`), Bet Types (`GET /api/bet-types`), Markets
  (`GET /api/markets`), and Fixtures (`GET /api/fixtures`) for the selected Date.
  The form's fields change based on the selected Bet Type:
  - **Accumulator / Bet Builder / Cross Match Bet Builder** render the shared
    `BetLegsEditor.vue` multi-leg editor instead of the single Fixture/Market/
    Player/Selection fields below.
  - **Player Prop / Match** render a Fixture picker (with a manual "Other / not
    listed" Home/Away Team fallback with autocomplete `<datalist>` suggestions),
    then a Market dropdown scoped to Player/Match markets respectively, then
    (conditionally) a Player dropdown (with its own manual fallback + suggestions)
    and a Selection dropdown (or a combined Selection+Line dropdown for markets with
    both) once the relevant prerequisite fields are set.
  - **Other** renders a free-text Bet Type input in place of the dropdown-derived
    type, plus the same Fixture field as Player Prop/Match.
  - **Superboost / Match** (non-multi-leg) still show the standard Fixture field.

  Stake Type (Normal/Free/Normal + Free) toggles between a single Stake field and
  separate Normal/Free Stake fields. Odds render either as a single decimal text
  input or a numerator/denominator pair, depending on the `oddsFormat` prop passed
  down from `BetsView.vue`'s user preference. An "Odds Boost?" checkbox reveals a
  Boost (%) field. Result defaults to "Open"; selecting "Cashed Out" reveals a Cash
  Out Value field. On successful submission (`POST /api/bets`), if the bet had a
  concrete fixture (not multi-leg) an "Add another?" confirmation prompt offers to
  repeat the same fixture/bet-type for a follow-up bet; otherwise the modal closes
  immediately. Any validation or submission error is rendered inline (no native
  browser dialogs).

- **How Reached:** Clicking the "Add Bet" button (`getByTestId('add-bet-button')`)
  on `/bets` — landmark defined in
  `ui-test-plan-bets-row-selection-bulk-actions.md`/`BetsPage`, not re-documented
  here.

## Elements Under Test

### Modal Shell

| Element                 | Locator                                     | Notes                                                                                                                               |
| ----------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Modal container         | `getByTestId('add-bet-modal')`              | `v-if="show"` — absent (not merely hidden) until the "Add Bet" button is clicked                                                    |
| Heading                 | `getByTestId('add-bet-modal-heading')`      | Static text "Add New Bet"                                                                                                           |
| Close (×) button        | `getByTestId('add-bet-modal-close-button')` | Text "×"; closes the modal without submitting, resetting the form                                                                   |
| Form                    | `getByTestId('add-bet-form')`               | Wraps every field below                                                                                                             |
| "Cancel" button         | `getByTestId('cancel-add-bet')`             | Text "Cancel"; identical effect to the × button                                                                                     |
| "Add Bet" submit button | `getByTestId('submit-add-bet')`             | Text "Add Bet"; `type="submit"`                                                                                                     |
| Form error message      | `getByTestId('add-bet-error')`              | `v-if="formError"`; absent by default; rendered inline (`text-red-600`, no native dialog) on validation or `POST /api/bets` failure |

### Core Fields (always visible)

| Element             | Locator                                    | Notes                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date label          | `getByTestId('add-bet-date-label')`        | Static text "Date"                                                                                                                                                                                                                            |
| Date input          | `getByTestId('input-date')`                | `type="date"`; defaults to today; `max` is capped at `MAX_BET_LOOKAHEAD_DAYS` (7 days ahead)                                                                                                                                                  |
| Bet Type label      | `getByTestId('add-bet-type-label')`        | Static text "Bet Type"                                                                                                                                                                                                                        |
| Bet Type dropdown   | `getByTestId('input-bet-type')`            | Options from `GET /api/bet-types` merged with `FALLBACK_BET_TYPES` (`Accumulator`, `Bet Builder`, `Cross Match Bet Builder`, `Match`, `Player Prop`, `Superboost`, `Other`); defaults to the user's saved default bet type (or "Player Prop") |
| Bookmaker label     | `getByTestId('add-bet-bookmaker-label')`   | Static text "Bookmaker"                                                                                                                                                                                                                       |
| Bookmaker dropdown  | `getByTestId('input-bookmaker')`           | Options from `GET /api/bookmakers`; defaults to the user's saved default bookmaker if set                                                                                                                                                     |
| Stake Type label    | `getByTestId('add-bet-stake-type-label')`  | Static text "Stake Type"                                                                                                                                                                                                                      |
| Stake Type dropdown | `getByTestId('input-stake-type')`          | Options `Normal` / `Free` / `Normal + Free`; defaults to "Normal"                                                                                                                                                                             |
| Odds Boost label    | `getByTestId('add-bet-odds-boost-label')`  | Wraps the checkbox; text "Odds Boost?"                                                                                                                                                                                                        |
| Odds Boost checkbox | `getByTestId('input-odds-boost-checkbox')` | Unchecked by default                                                                                                                                                                                                                          |
| Result label        | `getByTestId('add-bet-result-label')`      | Static text "Result"                                                                                                                                                                                                                          |
| Result dropdown     | `getByTestId('input-result')`              | Options `Open`/`Win`/`Loss`/`Cashed Out`; defaults to "Open"                                                                                                                                                                                  |

### Conditional: "Other" Bet Type

| Element              | Locator                                   | Notes                                                                                  |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Other Bet Type label | `getByTestId('add-other-bet-type-label')` | Static text "Bet Type"; `v-if="betType === 'Other'"` — absent for every other bet type |
| Other Bet Type input | `getByTestId('input-other-bet-type')`     | Free-text; empty by default; required only when visible                                |

### Conditional: Multi-Leg Bet Types (Accumulator / Bet Builder / Cross Match Bet Builder)

| Element                              | Locator                                                | Notes                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Legs label                           | `getByTestId('add-bet-legs-label')`                    | Static text "Legs"; `v-if="isMultiLegBetType"` — absent for Player Prop/Match/Superboost/Other                                         |
| Bet Builder shared Fixture label     | `getByTestId('bet-builder-fixture-label')`             | On `BetLegsEditor.vue`; only rendered when `betType === 'Bet Builder'`                                                                 |
| Bet Builder shared Fixture dropdown  | `getByTestId('input-bet-builder-fixture')`             | Grouped by league (`<optgroup>`); every leg mirrors this single fixture                                                                |
| Leg container                        | `getByTestId('bet-leg-${index}')`                      | One per leg (0-indexed); Accumulator/Cross Match Bet Builder start with 2 legs, minimum 2                                              |
| Leg "Remove" button                  | `getByTestId('remove-bet-leg-${index}')`               | `v-if="legs.length > minLegs"` — absent when at the 2-leg minimum                                                                      |
| Leg Fixture label                    | `getByTestId('bet-leg-fixture-label-${index}')`        | `v-if="betType !== 'Bet Builder'"` — Bet Builder uses the shared fixture picker above instead                                          |
| Leg Fixture dropdown                 | `getByTestId('input-bet-leg-fixture-${index}')`        | Grouped by league; Accumulator excludes fixtures already used on another leg                                                           |
| Leg fixture-conflict message         | `getByTestId('bet-leg-fixture-conflict-${index}')`     | `v-if` only for Accumulator with a duplicate-fixture conflict; absent otherwise                                                        |
| Leg Market label                     | `getByTestId('bet-leg-market-label-${index}')`         | Static text "Market"                                                                                                                   |
| Leg Market dropdown                  | `getByTestId('input-bet-leg-market-${index}')`         | Grouped Match/Player Markets `<optgroup>`s; `disabled` until the leg's fixture is set                                                  |
| Leg Player label                     | `getByTestId('bet-leg-player-label-${index}')`         | `v-if="marketFor(leg)?.requiresPlayer"`                                                                                                |
| Leg Player dropdown                  | `getByTestId('input-bet-leg-player-${index}')`         | Grouped by home/away team                                                                                                              |
| Leg Selection label                  | `getByTestId('bet-leg-selection-label-${index}')`      | `v-if` market has selections and isn't Yes-only                                                                                        |
| Leg Selection dropdown               | `getByTestId('input-bet-leg-selection-${index}')`      | Shown when the market doesn't combine selection+line                                                                                   |
| Leg combined Selection+Line dropdown | `getByTestId('input-bet-leg-selection-line-${index}')` | Shown instead of the plain Selection dropdown for markets needing both                                                                 |
| "+ Add leg" button                   | `getByTestId('add-bet-leg')`                           | `v-if="canAddLeg"` (Accumulator capped at the number of available fixtures)                                                            |
| Rule message                         | `getByTestId('bet-legs-rule-message')`                 | Always visible when a multi-leg type is selected; text depends on bet type (e.g. "Accumulator: pick at least 2 different fixtures...") |

### Conditional: Fixture / Player Prop / Match / Other (non-multi-leg)

| Element                          | Locator                                           | Notes                                                                                                  |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fixture label                    | `getByTestId('add-bet-fixture-label')`            | `v-if="betType !== 'Accumulator' && !isMultiLegBetType"`                                               |
| Fixture dropdown                 | `getByTestId('input-fixture')`                    | Grouped by league; includes an "Other / not listed" (`__manual__`) option                              |
| Home Team input                  | `getByTestId('input-home-team')`                  | `v-if="selectedFixtureId === '__manual__'"`; autocomplete via `add-home-team-suggestions` `<datalist>` |
| Away Team input                  | `getByTestId('input-away-team')`                  | Same conditional; autocomplete via `add-away-team-suggestions` `<datalist>`                            |
| Market label                     | `getByTestId('add-bet-market-label')`             | `v-if="isMarketBetType && hasFixtureSelected"` (Player Prop/Match only)                                |
| Market dropdown                  | `getByTestId('input-player-prop-market')`         | Scoped to Player Markets (Player Prop) or Match Markets (Match)                                        |
| Player label                     | `getByTestId('add-bet-player-label')`             | `v-if` selected market `requiresPlayer`                                                                |
| Player dropdown                  | `getByTestId('input-player')`                     | Grouped by home/away team; includes "Other / not listed" (`__manual__`)                                |
| Player manual input              | `getByTestId('input-player-manual')`              | `v-if="selectedPlayerId === '__manual__'"`; autocomplete via `add-player-suggestions` `<datalist>`     |
| Selection label                  | `getByTestId('add-bet-selection-label')`          | `v-if` market has selections and isn't Yes-only                                                        |
| Selection dropdown               | `getByTestId('input-player-prop-selection')`      | Shown when the market doesn't combine selection+line                                                   |
| Combined Selection+Line dropdown | `getByTestId('input-player-prop-selection-line')` | Shown instead, for markets needing both                                                                |

### Stake / Odds

| Element                   | Locator                                           | Notes                                                                                        |
| ------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Stake label               | `getByTestId('add-bet-stake-label')`              | `v-if="stakeType !== 'Normal + Free'"`; text "Stake (£)"                                     |
| Stake input               | `getByTestId('input-stake')`                      | `type="number"`; defaults to the user's saved default stake (or 5)                           |
| Normal Stake label        | `getByTestId('add-bet-normal-stake-label')`       | `v-if="stakeType === 'Normal + Free'"`; text "Normal Stake (£)"                              |
| Normal Stake input        | `getByTestId('input-normal-stake')`               | `type="number"`; empty by default                                                            |
| Free Stake label          | `getByTestId('add-bet-free-stake-label')`         | Text "Free Stake (£)"                                                                        |
| Free Stake input          | `getByTestId('input-free-stake')`                 | `type="number"`; empty by default                                                            |
| Odds label                | `getByTestId('add-bet-odds-label')`               | Static text "Odds"                                                                           |
| Decimal odds input        | `getByTestId('input-odds')`                       | `v-else` (shown when `oddsFormat !== 'fractional'`); placeholder "e.g. 2.5"; defaults to "2" |
| Fractional odds container | `getByTestId('input-odds-fractional')`            | `v-if="props.oddsFormat === 'fractional'"`                                                   |
| Odds numerator input      | `getByTestId('input-odds-numerator')`             | Defaults to 1                                                                                |
| Odds denominator input    | `getByTestId('input-odds-denominator')`           | Defaults to 1                                                                                |
| Odds Boost Percent label  | `getByTestId('add-bet-odds-boost-percent-label')` | `v-if="isOddsBoost"`; text "Boost (%)"                                                       |
| Odds Boost Percent input  | `getByTestId('input-odds-boost-percent')`         | `type="number"`; empty by default                                                            |

### Result

| Element              | Locator                                       | Notes                                                       |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| Cash Out Value label | `getByTestId('add-bet-cash-out-value-label')` | `v-if="result === 'Cashed Out'"`; text "Cash Out Value (£)" |
| Cash Out Value input | `getByTestId('input-cash-out-value')`         | `type="number"`; empty by default                           |

### "Add another?" Prompt

| Element          | Locator                                     | Notes                                                                                                              |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Prompt container | `getByTestId('add-another-bet-prompt')`     | `v-if="showAddAnotherPrompt"` — absent until a non-multi-leg bet with a concrete fixture is successfully submitted |
| Heading          | `getByTestId('add-another-bet-heading')`    | Static text "Add another?"                                                                                         |
| Body text        | `getByTestId('add-another-bet-text')`       | Static text "Bet added successfully. Would you like to add another bet on the same fixture?"                       |
| "No" button      | `getByTestId('add-another-bet-no-button')`  | Closes the prompt and the modal, resetting the form                                                                |
| "Yes" button     | `getByTestId('add-another-bet-yes-button')` | Closes the prompt, keeps the modal open with the same fixture/bet type prefilled                                   |

## Test Coverage Summary

**Total Scenarios:** 19 (2 Cosmetic, 17 Functional, 0 Navigation)

## Test Scenarios

| Scenario | Scenario Type | Use Case                                                                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Expected Result                                                                                                                                                                                                                                                                                                            |
| -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Cosmetic      | Modal opens with default (Player Prop) state rendered correctly                                                                    | Click "Add Bet" on `/bets`. Verify the modal container, heading, close button, and every core field (Date, Bet Type, Bookmaker, Stake Type, Odds Boost checkbox, Result) render with correct labels/defaults; verify Fixture/Market/Player/Selection fields for the default "Player Prop" bet type are present with correct default state; verify the Cancel/Add Bet buttons are visible/enabled with correct text; verify conditionally-hidden elements (Other Bet Type input, Legs editor, Player field, Selection field, Cash Out Value, Boost %, Normal/Free Stake, form error, Add another? prompt) are absent from the DOM | Modal is visible; heading reads "Add New Bet"; all default-state elements render with correct text/values as documented in Elements Under Test; all conditionally-hidden elements are absent from the DOM                                                                                                                  |
| 2        | Cosmetic      | Bet Type dropdown shows correct default and full option list                                                                       | On modal open, verify the Bet Type dropdown's options match `GET /api/bet-types` merged with the fallback list, in order, and the default selection matches the user's saved default (or "Player Prop")                                                                                                                                                                                                                                                                                                                                                                                                                          | All expected bet-type options are present in the correct order; default selection is correct                                                                                                                                                                                                                               |
| 3        | Functional    | Selecting "Other" reveals the free-text Bet Type input                                                                             | Select "Other" in the Bet Type dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Other Bet Type input becomes visible and is required; the standard Bet Type dropdown value is retained as "Other"                                                                                                                                                                                                          |
| 4        | Functional    | Selecting a multi-leg bet type swaps Fixture/Market/Player/Selection for the Legs editor                                           | Select "Accumulator" in the Bet Type dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Legs label and the shared `BetLegsEditor` (2 leg containers, each with Fixture/Market labels) become visible; the standalone Fixture/Market/Player/Selection fields become absent from the DOM; the rule message reads the Accumulator-specific text                                                                       |
| 5        | Functional    | Selecting "Bet Builder" renders the shared single-fixture picker instead of a per-leg fixture picker                               | With "Bet Builder" selected as the Bet Type, verify the shared Bet Builder Fixture dropdown is visible, and each leg's own Fixture label/dropdown is absent                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Shared Fixture dropdown is visible; per-leg Fixture fields are absent for every leg; each leg still shows its own Market field                                                                                                                                                                                             |
| 6        | Functional    | "+ Add leg" adds a leg and "Remove" removes it (Cross Match Bet Builder)                                                           | With "Cross Match Bet Builder" selected, click "+ Add leg", then click the third leg's "Remove" button                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | A third leg container appears after clicking "+ Add leg"; the "Remove" button is visible on all legs while more than 2 exist; clicking "Remove" returns to 2 leg containers                                                                                                                                                |
| 7        | Functional    | Selecting a listed Fixture (Player Prop) reveals the Market field, hidden beforehand                                               | With "Player Prop" selected, verify the Market label/dropdown are absent before a fixture is chosen; select a fixture from the Fixture dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Market label and dropdown become visible only after a fixture is selected                                                                                                                                                                                                                                                  |
| 8        | Functional    | Choosing "Other / not listed" in the Fixture dropdown reveals Home/Away Team inputs                                                | Select the "Other / not listed" option in the Fixture dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Home Team and Away Team text inputs become visible, both required; selecting a listed fixture instead keeps them absent                                                                                                                                                                                                    |
| 9        | Functional    | Selecting a Market that requires a player reveals the Player field                                                                 | With a fixture selected, choose a Market whose `requiresPlayer` is `true`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Player label and dropdown become visible; choosing a Market that doesn't require a player keeps them absent                                                                                                                                                                                                                |
| 10       | Functional    | Choosing "Other / not listed" in the Player dropdown reveals the manual Player input                                               | With the Player dropdown visible, select "Other / not listed"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Player manual text input becomes visible and required                                                                                                                                                                                                                                                                      |
| 11       | Functional    | Selecting a Market with selections reveals the Selection (or combined Selection+Line) field                                        | Choose a Market with one or more selections that is not Yes-only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Selection dropdown (or the combined Selection+Line dropdown, for markets needing both) becomes visible; choosing a Yes-only market keeps it absent                                                                                                                                                                         |
| 12       | Functional    | Stake Type "Normal + Free" swaps the single Stake field for separate Normal/Free Stake fields                                      | Select "Normal + Free" in the Stake Type dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Stake label/input become absent; Normal Stake and Free Stake labels/inputs both become visible, both required; reselecting "Normal" or "Free" restores the single Stake field                                                                                                                                              |
| 13       | Functional    | Odds format prop toggles between decimal input and fractional numerator/denominator inputs                                         | Render the modal with `oddsFormat="fractional"` vs. the default (decimal)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | With `oddsFormat="fractional"`, the fractional odds container (numerator "/" denominator) is visible and the decimal odds input is absent; with the default format, the decimal odds input is visible and the fractional container is absent                                                                               |
| 14       | Functional    | Checking "Odds Boost?" reveals the Boost (%) field                                                                                 | Check the "Odds Boost?" checkbox                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Boost (%) label and input become visible, required; unchecking the box hides them again                                                                                                                                                                                                                                    |
| 15       | Functional    | Selecting "Cashed Out" as Result reveals the Cash Out Value field                                                                  | Select "Cashed Out" in the Result dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Cash Out Value label and input become visible, required; selecting any other Result option hides them again                                                                                                                                                                                                                |
| 16       | Functional    | Submitting with invalid odds shows an inline error and does not close the modal                                                    | Leave the decimal Odds input as clearly invalid (e.g. clear it) and submit the form                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Form error message becomes visible with an odds-related message (e.g. "Please enter valid decimal odds (minimum 1)."); the modal remains open; no `POST /api/bets` request is made                                                                                                                                         |
| 17       | Functional    | Successful submission with a concrete fixture shows the "Add another?" prompt; choosing "Yes" keeps the modal open, "No" closes it | Fill a valid Player Prop bet (with a real fixture) and submit; observe the "Add another?" prompt; test both the "Yes" and "No" buttons (as separate assertions within the scenario)                                                                                                                                                                                                                                                                                                                                                                                                                                              | `POST /api/bets` succeeds; "Add another?" prompt becomes visible with its heading/body text; clicking "Yes" hides the prompt and keeps the modal open with the same fixture/bet type retained; clicking "No" (on a fresh repeat of the same submission) hides the prompt and closes the modal entirely, resetting the form |
| 18       | Functional    | End-to-end: a bet added via the modal appears correctly in the Bets table and updates the summary stats                          | On `/bets` with a known starting set of seeded bets, note the current Total Bets/Total P/L values, then open Add Bet, submit a valid non-multi-leg bet with distinctive/known field values (Date, Bookmaker, Stake, Odds, Result), and dismiss the "Add another?" prompt with "No"                                                                                                                                                                                                                                                                                                                                            | The modal closes; a new row appears in the Bets table (desktop) matching the submitted Date/Bookmaker/Stake/Odds/Result; Total Bets count increments by 1; Total P/L reflects the new bet's contribution (0 for an "Open" result)                                                                                        |
| 19       | Functional    | End-to-end: a freshly-added bet is discoverable via the Bets page filters and excluded when filtered out                         | Following on from Scenario 18 (or a fresh equivalent add), open the Filters panel and set the Bookie filter (or Result filter) to match the newly-added bet's value, then to a different value                                                                                                                                                                                                                                                                                                                                                                                                                                 | With the matching filter value selected, the new bet's row remains visible in the table; with a non-matching filter value selected, the new bet's row is no longer present                                                                                                                                               |


## Out of Scope

- **Edit Bet** (`EditBetModal.vue`) — future dedicated UI test plan; despite sharing
  ~90% of its fields/logic with this modal via `useBetForm`, it hydrates from an
  existing bet and has its own title/condensation behaviour, so it warrants its own
  plan rather than being folded into this one.
- **Backend/API validation content** (exact error messages returned by
  `POST /api/bets`, field-level server-side rules) — belongs to the API test plan for
  `POST /api/bets` if/when one exists (no such plan currently exists under
  `playwright/docs/test-plans/api/` — `apps/api/openapi/bets.yaml`'s `createBet`
  operation is the source of truth for that future plan).
- **Correctness of the underlying reference data** (which fixtures/markets/players
  are returned by `GET /api/fixtures`, `GET /api/markets`,
  `GET /api/fixtures/:id/players`, `GET /api/suggestions`) — this plan only verifies
  the modal's own UI wiring/conditional rendering against whatever data those
  endpoints return, not the data's own correctness (covered by their own API test
  plans: `playwright/docs/test-plans/api/fixtures/`,
  `playwright/docs/test-plans/api/markets/`).
- **Exhaustive table/summary/filter behaviour** (sort order across all columns,
  pagination, column-visibility toggles, bulk actions, exact P/L colour/formatting
  rules) — covered by `ui-test-plan-bets-summary-filters.md`,
  `ui-test-plan-bets-table-display.md`, and
  `ui-test-plan-bets-row-selection-bulk-actions.md`. Scenarios 18–19 in this plan
  validate only the single end-to-end journey of a freshly-added bet appearing in
  the table/stats and being correctly surfaced/excluded by a filter — not every
  filter/column/sort permutation, which remains the responsibility of those three
  plans.
- **User default preferences themselves** (how `GET /api/user/config` values are
  set) — covered by the signup/preferences UI test plans
  (`ui-test-plan-auth-signup.md`, `top-banner-bet-preferences.spec.ts`); this plan
  only verifies that the Add Bet modal correctly _consumes_ those defaults on open.
- **Shared header/tab-nav** (`TopBanner.vue`, `TabNav.vue`) — already covered by
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md` and
  `ui-test-plan-tab-nav.md`; referenced, not re-documented here.
- **Every individual bet-type/market/selection combination exhaustively** — Scenario
  coverage above exercises each conditional branch at least once; it does not attempt
  to enumerate every possible market/selection/line permutation across all bet types.

## Automation Status

Automated by `support/pages/bets.page.ts` (`BetsPage`, extended with
`readonly addBetModal: AddBetModalComponent`), a new
`support/pages/shared/add-bet-modal.component.ts` (`AddBetModalComponent`) composing
a new `support/pages/shared/bet-legs-editor.component.ts` (`BetLegsEditorComponent`,
also intended for reuse by the future Edit Bet plan). All locators are exposed via
`data-test-id` attributes added to `AddBetModal.vue`/`BetLegsEditor.vue` specifically
for this plan — see **Elements Under Test** above.

Seeding/cleanup follows the existing pattern used by
`tests/functional/top-banner-bet-preferences.spec.ts`: a fresh account is created via
`signUp()` in `test.beforeEach`, with cleanup via `deleteAccount()`
(`DELETE /api/auth/me`) in `test.afterEach`. Scenario 17 additionally relies on real
fixture data returned by `GET /api/fixtures` for the current date to pick a concrete
fixture.

Scenarios 18–19 are automated separately in a new
`tests/e2e/bets-add-bet-journey.spec.ts`, since they exercise the full journey across
`AddBetModalComponent` and `BetsPage`'s table/summary-stats/filter-panel locators
(composed from `ui-test-plan-bets-summary-filters.md`,
`ui-test-plan-bets-table-display.md`, and
`ui-test-plan-bets-row-selection-bulk-actions.md`'s automation) rather than the modal
in isolation — following the repo's `smoke`/`functional`/`e2e` tiering convention.
This spec seeds a small known set of bets via `seedBets()`
(`support/functions/bet-seeding.ts`) in `test.beforeEach` (to establish a
non-zero baseline Total Bets/Total P/L to assert the increment against), then drives
the remainder of the journey through the UI (`AddBetModalComponent` submission,
`BetsPage` table/summary/filter assertions), with `deleteAccount()` cleanup in
`test.afterEach` as usual.

| Scenario | Status           | Spec file                                               |
| -------- | ---------------- | -------------------------------------------------------- |
| 1        | ❌ Not Automated | `tests/smoke/bets-add-bet.spec.ts` (to be created)      |
| 2        | ❌ Not Automated | `tests/smoke/bets-add-bet.spec.ts` (to be created)      |
| 3        | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 4        | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 5        | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 6        | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 7        | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 8        | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 9        | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 10       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 11       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 12       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 13       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 14       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 15       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 16       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 17       | ❌ Not Automated | `tests/functional/bets-add-bet.spec.ts` (to be created) |
| 18       | ❌ Not Automated | `tests/e2e/bets-add-bet-journey.spec.ts` (to be created) |
| 19       | ❌ Not Automated | `tests/e2e/bets-add-bet-journey.spec.ts` (to be created) |


## References

- Application source: `apps/web/src/components/AddBetModal.vue` (updated with
  `data-test-id` attributes for this plan's Elements Under Test),
  `apps/web/src/components/BetLegsEditor.vue` (same, shared with the future Edit Bet
  plan), `apps/web/src/composables/useBetForm.ts`
- Supporting utils: `apps/web/src/utils/marketOptions.ts`,
  `apps/web/src/utils/fixtureGrouping.ts`, `apps/web/src/utils/odds.ts`,
  `apps/web/src/utils/league.ts`
- API endpoints exercised: `POST /api/bets`, `GET /api/bookmakers`,
  `GET /api/bet-types`, `GET /api/markets`, `GET /api/fixtures`,
  `GET /api/fixtures/:id/players`, `GET /api/suggestions`, `GET /api/user/config`
  (`apps/api/openapi/bets.yaml`)
- Related UI test plans:
  `playwright/docs/test-plans/ui/bets/ui-test-plan-bets-summary-filters.md`,
  `ui-test-plan-bets-table-display.md`,
  `ui-test-plan-bets-row-selection-bulk-actions.md` — their `BetsPage` table/summary/
  filter locators are consumed by Scenarios 18–19's end-to-end journey coverage here
  (referenced, not re-documented),
  `playwright/docs/test-plans/ui/shell/ui-test-plan-top-banner.md`,
  `ui-test-plan-tab-nav.md` (shared shell, referenced not re-documented)
- Seeding/cleanup pattern reference: `playwright/tests/functional/top-banner-bet-preferences.spec.ts`
- Page Objects: `playwright/support/pages/bets.page.ts` (extended by this plan),
  `playwright/support/pages/shared/add-bet-modal.component.ts` (new),
  `playwright/support/pages/shared/bet-legs-editor.component.ts` (new)
- Spec files: `tests/functional/bets-add-bet.spec.ts` (Scenarios 3–17, to be created),
  `tests/e2e/bets-add-bet-journey.spec.ts` (Scenarios 18–19, to be created)
