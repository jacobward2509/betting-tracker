import {apiGet, apiPost, deleteAccount} from '@functions/index';
import {assertMarketsSchema} from '@schema-assertions/markets';
import {maximumSignupBody} from '@seed-data/auth';


import {APIRequestContext, APIResponse, expect, test} from '@playwright/test';

test.describe('Markets endpoints-V2', () => {
  test.describe('getMarkets', () => {
    const URL_STUB = 'api/markets';

    // No market data is seeded, cleaned up, or otherwise manufactured by
    // this suite — per
    // playwright/docs/test-plans/api/markets/test-plan-get-markets.md, this
    // is a black-box test of whatever the structured market catalog
    // actually contains (populated out-of-band by scripts/seed-markets.ts,
    // not by this test suite).

    test.describe('200 - Accepted', () => {
      let token: string;

      test.afterEach(async ({request}: {request: APIRequestContext}) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test('Valid request returns the full structured market catalog', async ({
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
        assertMarketsSchema(body);

        const sortOrders = body.map((market: {sortOrder: number}) => market.sortOrder);
        const sortedSortOrders = [...sortOrders].sort((a, b) => a - b);
        expect(sortOrders, 'Top-level Market[] array should be ordered by sortOrder ascending').toEqual(
          sortedSortOrders,
        );

        for (const market of body) {
          const selectionSortOrders = market.selections.map((selection: {sortOrder: number}) => selection.sortOrder);
          const sortedSelectionSortOrders = [...selectionSortOrders].sort((a, b) => a - b);
          expect(
            selectionSortOrders,
            `Market "${market.name}" selections should be ordered by sortOrder ascending`,
          ).toEqual(sortedSelectionSortOrders);

          const lineSortOrders = market.lines.map((line: {sortOrder: number}) => line.sortOrder);
          const sortedLineSortOrders = [...lineSortOrders].sort((a, b) => a - b);
          expect(lineSortOrders, `Market "${market.name}" lines should be ordered by sortOrder ascending`).toEqual(
            sortedLineSortOrders,
          );

          expect(
            market.requiresPlayer ? market.category === 'PLAYER' : market.category === 'MATCH',
            `Market "${market.name}" requiresPlayer (${market.requiresPlayer}) should correlate with category (${market.category})`,
          ).toBe(true);
        }
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
        response = await apiGet(request, URL_STUB, {
          noAuth: true,
        });
      });
    });
  });
});
