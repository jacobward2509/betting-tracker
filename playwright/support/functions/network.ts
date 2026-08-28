import { Page, Response } from '@playwright/test';

/**
 * Registers a listener for the first response matching the given method and
 * URL substring, returning a promise that resolves once it fires. Must be
 * awaited (or its returned promise held) AFTER being called but BEFORE the
 * action that triggers the request, otherwise the response may resolve
 * before the listener attaches — see playwright-ui-test-generation.md §8a.
 */
export function waitForResponse(page: Page, method: string, urlSubstring: string): Promise<Response> {
  return page.waitForResponse(
    (response) => response.request().method() === method && response.url().includes(urlSubstring),
  );
}
