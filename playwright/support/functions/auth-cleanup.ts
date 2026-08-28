import { APIRequestContext } from '@playwright/test';
import { apiDelete } from './request-methods';
import { API_BASE_URL } from '../../playwright.config';

/**
 * Deletes the account identified by the given bearer session token via
 * DELETE /api/auth/me, cleaning up an account seeded/created by a test (e.g.
 * via signup) so it doesn't leak between runs or environments. Uses an
 * absolute URL against API_BASE_URL, since UI-tier tests' baseURL points at
 * the web app rather than the API.
 */
export async function deleteAccount(request: APIRequestContext, token: string): Promise<void> {
  await apiDelete(request, `${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    noAuth: true,
  });
}
