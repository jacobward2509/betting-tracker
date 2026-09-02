import {apiGet, apiPost, apiPut, deleteAccount} from '@functions/index';
import {assertUserConfigSchema, assertUserConfigErrorResponseSchema} from '@schema-assertions/user-config';
import {maximumSignupBody} from '@seed-data/auth';
import {
  BOOKMAKER_ENUM,
  maximumUpdateUserConfigBody,
  type Bookmaker,
} from '@seed-data/user-config';




import {APIRequestContext, APIResponse, expect, test} from '@playwright/test';

test.describe('User Config endpoints-V2', () => {

  test.describe('getUserConfig', () => {
    const URL_STUB = 'api/user/config';

    test.describe('200 - Accepted', () => {
      let token: string;

      test.afterEach(async ({request}: {request: APIRequestContext}) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test('Valid request returns the current user\'s config', async ({
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

        const response: APIResponse = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(
          Array.isArray(body.bookmakers) && body.bookmakers.length === BOOKMAKER_ENUM.length,
          'bookmakers should contain exactly the 23 tracked bookmakers',
        ).toBe(true);

        const expectedEnabled = body.bookmakers
          .filter((item: {bookmaker: string; enabled: boolean}) => item.enabled)
          .map((item: {bookmaker: string; enabled: boolean}) => item.bookmaker)
          .sort();
        expect(
          [...body.enabledBookmakers].sort(),
          'enabledBookmakers should be exactly the bookmakers flagged as enabled: true',
        ).toEqual(expectedEnabled);

        expect(
          body.defaults.bookmaker === null || body.enabledBookmakers.includes(body.defaults.bookmaker),
          'defaults.bookmaker should be null or one of enabledBookmakers',
        ).toBe(true);
        expect(
          typeof body.defaults.betType === 'string' && body.defaults.betType.length > 0,
          'defaults.betType should be a non-empty string',
        ).toBe(true);
        expect(
          typeof body.defaults.stake === 'number' && body.defaults.stake > 0 && body.defaults.stake <= 10000,
          'defaults.stake should be a positive number <= 10000',
        ).toBe(true);
      });

      test('First call for a brand-new user auto-provisions platform defaults', async ({
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

        const response: APIResponse = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(body.defaults.betType, 'defaults.betType should default to "Player Prop"').toBe(
          'Player Prop',
        );
        expect(body.defaults.stake, 'defaults.stake should default to 5').toBe(5);
        expect(
          body.bookmakers.every((item: {bookmaker: string; enabled: boolean}) => item.enabled),
          'Every tracked bookmaker should be enabled by default',
        ).toBe(true);
        expect(
          [...body.enabledBookmakers].sort(),
          'enabledBookmakers should contain all 23 tracked bookmakers',
        ).toEqual([...BOOKMAKER_ENUM].sort());
      });
    });

    test.describe('401 - Unauthorized', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/user-config/test-plan-get-user-config.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });

      test('Missing auth header', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, URL_STUB, {noAuth: true});
      });
    });
  });

  test.describe('updateUserConfig', () => {
    const URL_STUB = 'api/user/config';
    let requestBody: any;


    test.beforeEach(() => {
      requestBody = maximumUpdateUserConfigBody();
    });

    test.describe('200 - Accepted', () => {
      // Serial: "Valid request with all fields" captures its update response in a
      // shared closure variable, and "Validate update via GET request" reads it back
      // — running serially avoids the two tests racing on the same account.
      test.describe.configure({mode: 'serial'});

      let token: string;
      let updateResponseBody: {
        bookmakers: {bookmaker: Bookmaker; enabled: boolean}[];
        enabledBookmakers: Bookmaker[];
        defaults: {bookmaker: Bookmaker | null; betType: string; stake: number};
      };

      test.afterAll(async ({request}: {request: APIRequestContext}) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test('Valid request with all fields', async ({
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

        const response: APIResponse = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(
          [...body.enabledBookmakers].sort(),
          'enabledBookmakers should match the requested set exactly',
        ).toEqual([...(requestBody.enabledBookmakers as Bookmaker[])].sort());
        expect(body.defaults.bookmaker, 'defaults.bookmaker should match the request').toBe(
          requestBody.defaultBookmaker,
        );
        expect(body.defaults.betType, 'defaults.betType should match the request').toBe(
          requestBody.defaultBetType,
        );
        expect(body.defaults.stake, 'defaults.stake should match the request').toBe(
          requestBody.defaultStake,
        );

        updateResponseBody = body;
      });

      test('Validate update via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const response: APIResponse = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'GET /api/user/config should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(
          [...body.enabledBookmakers].sort(),
          'enabledBookmakers should match the persisted update',
        ).toEqual([...updateResponseBody.enabledBookmakers].sort());
        expect(body.defaults.bookmaker, 'defaults.bookmaker should match the persisted update').toBe(
          updateResponseBody.defaults.bookmaker,
        );
        expect(body.defaults.betType, 'defaults.betType should match the persisted update').toBe(
          updateResponseBody.defaults.betType,
        );
        expect(body.defaults.stake, 'defaults.stake should match the persisted update').toBe(
          updateResponseBody.defaults.stake,
        );
      });
    });

    test.describe('200 - Accepted (independent scenarios)', () => {
      let token: string;

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

      test('Valid request with an empty body', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const before = await apiGet(request, URL_STUB, {

          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });
        const beforeBody = await before.json();

        requestBody = {};
        const response: APIResponse = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(body, 'Config should be unchanged after an empty-body update').toEqual(beforeBody);
      });

      test('Update only defaultStake (single-field partial update)', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const before = await apiGet(request, URL_STUB, {
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });
        const beforeBody = await before.json();

        requestBody = {defaultStake: 25};
        const response: APIResponse = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(body.defaults.stake, 'defaults.stake should be updated to 25').toBe(25);
        expect(
          [...body.enabledBookmakers].sort(),
          'enabledBookmakers should be unchanged',
        ).toEqual([...beforeBody.enabledBookmakers].sort());
        expect(body.defaults.bookmaker, 'defaults.bookmaker should be unchanged').toBe(
          beforeBody.defaults.bookmaker,
        );
        expect(body.defaults.betType, 'defaults.betType should be unchanged').toBe(
          beforeBody.defaults.betType,
        );
      });


      test('enabledBookmakers fully replaces the previous set', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        requestBody = {enabledBookmakers: ['Bet365', 'Betfair', 'BetUK', 'Ladbrokes', 'PaddyPower']};
        const firstUpdate = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });
        expect(firstUpdate.status(), 'First update should return 200').toBe(200);

        requestBody = {enabledBookmakers: ['SkyBet', 'WilliamHill']};
        const response: APIResponse = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Second update should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(
          [...body.enabledBookmakers].sort(),
          "enabledBookmakers should contain exactly the second update's set, not a union of both",
        ).toEqual(['SkyBet', 'WilliamHill'].sort());
      });

      test('Duplicate entries in enabledBookmakers are de-duplicated', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        requestBody = {enabledBookmakers: ['Bet365', 'Bet365']};
        const response: APIResponse = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(
          body.enabledBookmakers,
          'enabledBookmakers should contain Bet365 only once',
        ).toEqual(['Bet365']);
      });

      test('defaultBookmaker auto-resets when no longer enabled', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        requestBody = {enabledBookmakers: ['Bet365', 'Betfair'], defaultBookmaker: 'Bet365'};
        const firstUpdate = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });
        expect(firstUpdate.status(), 'First update should return 200').toBe(200);
        const firstBody = await firstUpdate.json();
        expect(firstBody.defaults.bookmaker, 'defaultBookmaker should be Bet365 after first update').toBe(
          'Bet365',
        );

        requestBody = {enabledBookmakers: ['Betfair', 'BetUK']};
        const response: APIResponse = await apiPut(request, URL_STUB, {
          data: requestBody,
          headers: {Authorization: `Bearer ${token}`},
          noAuth: true,
        });

        expect(response.status(), 'Second update should return 200').toBe(200);
        const body = await response.json();
        assertUserConfigSchema(body);

        expect(
          body.defaults.bookmaker !== 'Bet365' && body.enabledBookmakers.includes(body.defaults.bookmaker),
          'defaults.bookmaker should have auto-reset to a newly-enabled bookmaker, not the stale Bet365',
        ).toBe(true);
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

      test.afterEach(async () => {
        expect(response.status(), 'Request should return 400').toBe(400);
        const body = await response.json();
        assertUserConfigErrorResponseSchema(body);
        expect(body.error.code, 'Error code is correct').toBe('VALIDATION_ERROR');
      });

      test.afterEach(async ({request}: {request: APIRequestContext}) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test.describe('Invalid Data Types', () => {
        test('enabledBookmakers as an Object', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.enabledBookmakers = {};
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('enabledBookmakers as an Empty Array', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.enabledBookmakers = [];
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('enabledBookmakers containing an untracked value', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.enabledBookmakers = ['NotARealBookmaker'];
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('enabledBookmakers element wrong casing', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.enabledBookmakers = ['bet365'];
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultBookmaker as a Number', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultBookmaker = 123;
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultBookmaker as an Empty String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultBookmaker = '';
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('Invalid defaultBookmaker value', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultBookmaker = 'NotARealBookmaker';
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultBetType as a Number', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultBetType = 123;
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultBetType as an Empty String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultBetType = '';
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('Invalid defaultBetType value', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultBetType = 'NotARealBetType';
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultStake as an Alpha String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultStake = 'abc';
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultStake as a Multi-Decimal', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultStake = '10.1.1';
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultStake at zero', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultStake = 0;
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultStake negative', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultStake = -5;
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultStake above maximum', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.defaultStake = 10001;
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('Unrecognized field present', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.notch = true;
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });
      });

      test.describe('Cross-Field Validation', () => {
        test('defaultBookmaker not among the supplied enabledBookmakers', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.enabledBookmakers = ['Betfair', 'BetUK'];
          requestBody.defaultBookmaker = 'Bet365';
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });

        test('defaultBookmaker not among the currently-enabled set', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.enabledBookmakers = ['Betfair', 'BetUK'];
          delete requestBody.defaultBookmaker;
          const narrow = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
          expect(narrow.status(), 'Narrowing update should return 200').toBe(200);

          requestBody = {defaultBookmaker: 'Bet365'};
          response = await apiPut(request, URL_STUB, {
            data: requestBody,
            headers: {Authorization: `Bearer ${token}`},
            noAuth: true,
          });
        });
      });
    });

    test.describe('401 - Unauthorized', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/user-config/test-plan-update-user-config.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });

      test('Missing auth header', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiPut(request, URL_STUB, {
          data: requestBody,
          noAuth: true,
        });
      });
    });
  });

});

