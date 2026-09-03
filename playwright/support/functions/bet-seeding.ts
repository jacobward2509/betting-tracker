import { APIRequestContext } from '@playwright/test';
import { apiPost } from './request-methods';
import { API_BASE_URL } from '../../playwright.config';
import { CreateBetRequestBody } from '@seed-data/bets';

/**
 * Seeds one or more bets for the account identified by the given bearer
 * session token via POST /api/bets, so UI-tier tests can exercise the Bets
 * page ("/bets") against known, deterministic data. Uses an absolute URL
 * against API_BASE_URL, since UI-tier tests' baseURL points at the web app
 * rather than the API — same pattern as deleteAccount() in auth-cleanup.ts.
 *
 * Cleanup does not delete these bets individually — the account created for
 * the test (see the signUp() + deleteAccount() pattern in
 * tests/functional/top-banner-bet-preferences.spec.ts) is deleted wholesale
 * in afterEach, and Bet.userId cascades on delete (see
 * apps/api/prisma/schema.prisma), removing every seeded bet along with it.
 */
export async function seedBets(
  request: APIRequestContext,
  token: string,
  bets: CreateBetRequestBody[],
): Promise<void> {
  for (const bet of bets) {
    const response = await apiPost(request, `${API_BASE_URL}/api/bets`, {
      data: bet,
      headers: { Authorization: `Bearer ${token}` },
      noAuth: true,
    });
    if (!response.ok()) {
      throw new Error(
        `Failed to seed bet (${response.status()}): ${JSON.stringify(bet)} — ${await response.text()}`,
      );
    }
  }
}
