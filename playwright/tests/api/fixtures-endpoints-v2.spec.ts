import {apiGet} from '@functions/index';
import {assertFixturesSchema} from '@schema-assertions/fixtures';

import {APIRequestContext, APIResponse, expect, test} from '@playwright/test';

test.describe('Fixtures endpoints-V2', () => {
  test.describe('getTodaysFixtures', () => {
    const URL_STUB = 'api/fixtures/today';

    // No test data is seeded or cleaned up for this endpoint — per
    // playwright/docs/test-plans/api/fixtures/test-plan-get-todays-fixtures.md,
    // this is a black-box test of whatever the endpoint's cache actually
    // contains. An empty array is a valid, expected response and is treated
    // as a pass (assertFixturesSchema's `items` schema is trivially
    // satisfied by an empty array), not as a gap requiring manufactured data.

    test.describe('200 - Accepted', () => {
      let response: APIResponse;

      test.afterEach(async () => {
        expect(response.status(), 'Request should return 200').toBe(200);
      });

      test('Returns a valid Fixture[] response, empty or populated', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, URL_STUB, {noAuth: true});
        const body = await response.json();

        assertFixturesSchema(body);
        expect(Array.isArray(body), 'Response body should be an array').toBe(true);

        if (body.length === 0) {
          // No tracked competition has a fixture today — a valid pass, per
          // the test plan's "empty array is a pass" scope note.
          return;
        }

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

        for (const fixture of body) {
          const kickoffAt = new Date(fixture.kickoffAt);
          expect(
            kickoffAt.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should be a valid date`,
          ).not.toBeNaN();
          expect(
            kickoffAt.getTime() >= startOfToday.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should not be before the start of today (UTC)`,
          ).toBe(true);
          expect(
            kickoffAt.getTime() < startOfTomorrow.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should be before the start of tomorrow (UTC)`,
          ).toBe(true);
        }
      });

      test('Response is ordered by kickoffAt ascending', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, URL_STUB, {noAuth: true});
        const body = await response.json();

        // Trivially passes on days with 0-1 fixtures, since ordering is
        // unobservable with fewer than two items — per the test plan.
        for (let i = 1; i < body.length; i += 1) {
          const previous = new Date(body[i - 1].kickoffAt).getTime();
          const current = new Date(body[i].kickoffAt).getTime();
          expect(
            previous <= current,
            `Fixture at index ${i} (kickoffAt ${body[i].kickoffAt}) should not be earlier than the previous fixture (kickoffAt ${body[i - 1].kickoffAt})`,
          ).toBe(true);
        }
      });

      test('Succeeds with no Authorization header (endpoint is unauthenticated)', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, URL_STUB, {noAuth: true});
        const body = await response.json();

        assertFixturesSchema(body);
      });
    });
  });
});
