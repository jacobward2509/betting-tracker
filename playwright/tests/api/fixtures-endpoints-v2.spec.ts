import {apiGet, apiPost, deleteAccount} from '@functions/index';
import {assertFixturesSchema} from '@schema-assertions/fixtures';
import {maximumSignupBody} from '@seed-data/auth';

import {APIRequestContext, APIResponse, expect, test} from '@playwright/test';

// Formats a Date as a UTC-anchored YYYY-MM-DD string, matching the `date`/
// `from`/`to` query parameter format expected by GET /api/fixtures.
const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);


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

      test('Resolves "today" against the caller-supplied tzOffsetMinutes rather than the server UTC clock', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        // A large positive offset (720 minutes = UTC-12, the furthest behind
        // UTC any real timezone gets) shifts "today" back by up to 12 hours
        // relative to the default UTC-day window used by Scenario 1. This
        // proves the endpoint actually reads tzOffsetMinutes rather than
        // silently ignoring it and always returning the UTC day.
        response = await apiGet(request, URL_STUB, {noAuth: true, params: {tzOffsetMinutes: '720'}});
        const body = await response.json();

        assertFixturesSchema(body);
        expect(Array.isArray(body), 'Response body should be an array').toBe(true);

        if (body.length === 0) {
          return;
        }

        const nowShifted = new Date(Date.now() - 720 * 60 * 1000);
        const startOfLocalDay = new Date(nowShifted);
        startOfLocalDay.setUTCHours(0, 0, 0, 0);
        const endOfLocalDay = new Date(startOfLocalDay);
        endOfLocalDay.setUTCDate(endOfLocalDay.getUTCDate() + 1);
        const startOfDayUtc = new Date(startOfLocalDay.getTime() + 720 * 60 * 1000);
        const endOfDayUtc = new Date(endOfLocalDay.getTime() + 720 * 60 * 1000);

        for (const fixture of body) {
          const kickoffAt = new Date(fixture.kickoffAt);
          expect(
            kickoffAt.getTime() >= startOfDayUtc.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should not be before the start of "today" for tzOffsetMinutes=720`,
          ).toBe(true);
          expect(
            kickoffAt.getTime() < endOfDayUtc.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should be before the start of "tomorrow" for tzOffsetMinutes=720`,
          ).toBe(true);
        }
      });
    });
  });

  test.describe('getFixturesForDate', () => {
    const URL_STUB = 'api/fixtures';

    test.describe('200 - Accepted', () => {
      let token: string;

      test.afterEach(async ({request}: {request: APIRequestContext}) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test('Valid request with a single date query parameter', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: maximumSignupBody(),
          noAuth: true,
        });
        const signupBody = await signupResponse.json();
        token = signupBody.token;

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const targetDate = new Date(startOfToday);
        targetDate.setUTCDate(targetDate.getUTCDate() + 3);
        const startOfTargetDay = new Date(targetDate);
        const startOfNextDay = new Date(targetDate);
        startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1);

        const response: APIResponse = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
          params: {date: toDateOnly(targetDate)},
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertFixturesSchema(body);
        expect(Array.isArray(body), 'Response body should be an array').toBe(true);

        for (const fixture of body) {
          const kickoffAt = new Date(fixture.kickoffAt);
          expect(
            kickoffAt.getTime() >= startOfTargetDay.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should not be before the start of the requested date`,
          ).toBe(true);
          expect(
            kickoffAt.getTime() < startOfNextDay.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should be before the start of the following day`,
          ).toBe(true);
        }
      });

      test('Valid request with an inclusive from/to range, ordered by kickoffAt ascending', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: maximumSignupBody(),
          noAuth: true,
        });
        const signupBody = await signupResponse.json();
        token = signupBody.token;

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const fromDate = new Date(startOfToday);
        fromDate.setUTCDate(fromDate.getUTCDate() + 1);
        const toDate = new Date(fromDate);
        toDate.setUTCDate(toDate.getUTCDate() + 1);
        const startOfRange = new Date(fromDate);
        const endOfRangeExclusive = new Date(toDate);
        endOfRangeExclusive.setUTCDate(endOfRangeExclusive.getUTCDate() + 1);

        const response: APIResponse = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
          params: {from: toDateOnly(fromDate), to: toDateOnly(toDate)},
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertFixturesSchema(body);
        expect(Array.isArray(body), 'Response body should be an array').toBe(true);

        for (const fixture of body) {
          const kickoffAt = new Date(fixture.kickoffAt);
          expect(
            kickoffAt.getTime() >= startOfRange.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should not be before the start of the from date`,
          ).toBe(true);
          expect(
            kickoffAt.getTime() < endOfRangeExclusive.getTime(),
            `Fixture ${fixture.id} kickoffAt (${fixture.kickoffAt}) should be before the day after the to date`,
          ).toBe(true);
        }

        // Trivially passes on ranges with 0-1 fixtures, since ordering is
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

      test('date is ignored once from/to is also supplied', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: maximumSignupBody(),
          noAuth: true,
        });
        const signupBody = await signupResponse.json();
        token = signupBody.token;

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const fromDate = new Date(startOfToday);
        fromDate.setUTCDate(fromDate.getUTCDate() + 1);
        const toDate = new Date(fromDate);
        toDate.setUTCDate(toDate.getUTCDate() + 1);
        // A date well outside the from/to range, to prove it's ignored rather
        // than used to filter/override the range.
        const outsideDate = new Date(startOfToday);
        outsideDate.setUTCDate(outsideDate.getUTCDate() + 6);

        const rangeOnlyResponse = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
          params: {from: toDateOnly(fromDate), to: toDateOnly(toDate)},
        });
        expect(rangeOnlyResponse.status(), 'from/to-only request should return 200').toBe(200);
        const rangeOnlyBody = await rangeOnlyResponse.json();

        const response: APIResponse = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
          params: {date: toDateOnly(outsideDate), from: toDateOnly(fromDate), to: toDateOnly(toDate)},
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertFixturesSchema(body);

        expect(
          body,
          'Response with date+from/to should match the from/to-only response, proving date was ignored',
        ).toEqual(rangeOnlyBody);
      });
    });

    test.describe('400 - Bad Request', () => {
      let token: string;
      let response: APIResponse;

      test.beforeEach(async ({request}: {request: APIRequestContext}) => {
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: maximumSignupBody(),
          noAuth: true,
        });
        const signupBody = await signupResponse.json();
        token = signupBody.token;
      });

      test.afterEach(async ({request}: {request: APIRequestContext}) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test.describe('Missing Mandatory Data', () => {
        test.afterEach(async () => {
          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'A valid date query parameter (YYYY-MM-DD) is required.',
          );
        });

        test('Missing date, from, and to entirely', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });
      });
      test.describe('Invalid Data Types', () => {
        test('date is an empty string', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {date: ''},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'A valid date query parameter (YYYY-MM-DD) is required.',
          );
        });

        test('date has an invalid format', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {date: '05-09-2026'},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'A valid date query parameter (YYYY-MM-DD) is required.',
          );
        });

        test('from supplied without to', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const fromDate = new Date();
          fromDate.setUTCHours(0, 0, 0, 0);
          fromDate.setUTCDate(fromDate.getUTCDate() + 1);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {from: toDateOnly(fromDate)},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'Valid from and to query parameters (YYYY-MM-DD) are required.',
          );
        });

        test('to supplied without from', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const toDate = new Date();
          toDate.setUTCHours(0, 0, 0, 0);
          toDate.setUTCDate(toDate.getUTCDate() + 1);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {to: toDateOnly(toDate)},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'Valid from and to query parameters (YYYY-MM-DD) are required.',
          );
        });

        test('from has an invalid format', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const toDate = new Date();
          toDate.setUTCHours(0, 0, 0, 0);
          toDate.setUTCDate(toDate.getUTCDate() + 1);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {from: '05-09-2026', to: toDateOnly(toDate)},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'Valid from and to query parameters (YYYY-MM-DD) are required.',
          );
        });

        test('to has an invalid format', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const fromDate = new Date();
          fromDate.setUTCHours(0, 0, 0, 0);
          fromDate.setUTCDate(fromDate.getUTCDate() + 1);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {from: toDateOnly(fromDate), to: '05-09-2026'},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'Valid from and to query parameters (YYYY-MM-DD) are required.',
          );
        });
      });

      test.describe('Cross-Field Validation', () => {
        test('to before from', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const fromDate = new Date();
          fromDate.setUTCHours(0, 0, 0, 0);
          fromDate.setUTCDate(fromDate.getUTCDate() + 2);
          const toDate = new Date(fromDate);
          toDate.setUTCDate(toDate.getUTCDate() - 1);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {from: toDateOnly(fromDate), to: toDateOnly(toDate)},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe('to must not be before from.');
        });

        test('from/to range spans more than 14 days', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const fromDate = new Date();
          fromDate.setUTCHours(0, 0, 0, 0);
          fromDate.setUTCDate(fromDate.getUTCDate() - 20);
          const toDate = new Date(fromDate);
          toDate.setUTCDate(toDate.getUTCDate() + 15);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {from: toDateOnly(fromDate), to: toDateOnly(toDate)},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'The from/to range cannot span more than 14 days.',
          );
        });

        test('Single date more than 7 days in the future', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const targetDate = new Date();
          targetDate.setUTCHours(0, 0, 0, 0);
          targetDate.setUTCDate(targetDate.getUTCDate() + 8);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {date: toDateOnly(targetDate)},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'Bets can only be logged up to 7 days in advance.',
          );
        });

        test('to more than 7 days in the future (range form)', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const fromDate = new Date();
          fromDate.setUTCHours(0, 0, 0, 0);
          fromDate.setUTCDate(fromDate.getUTCDate() + 1);
          const toDate = new Date(fromDate);
          toDate.setUTCDate(toDate.getUTCDate() + 7);

          response = await apiGet(request, URL_STUB, {
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
            params: {from: toDateOnly(fromDate), to: toDateOnly(toDate)},
          });

          expect(response.status(), 'Request should return 400').toBe(400);
          const body = await response.json();
          expect(body.error, 'Error message is correct').toBe(
            'Bets can only be logged up to 7 days in advance.',
          );
        });
      });
    });

    test.describe('401 - Unauthorized', () => {
      let response: APIResponse;

      test.afterEach(async () => {
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });

      test('Missing Authorization header', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const targetDate = new Date();
        targetDate.setUTCHours(0, 0, 0, 0);
        targetDate.setUTCDate(targetDate.getUTCDate() + 1);

        response = await apiGet(request, URL_STUB, {
          noAuth: true,
          params: {date: toDateOnly(targetDate)},
        });
      });
    });
  });
});


