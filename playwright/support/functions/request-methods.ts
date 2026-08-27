import {APIRequestContext, APIResponse, test} from '@playwright/test'
import fs from 'fs'
import path from 'path'

type WithNoAuth<T> = T & {noAuth?: boolean}

// Attachments larger than this are truncated before being attached to the
// test report, so a single oversized payload can't bloat the HTML report
// (or, downstream, a Jira bug ticket built from it).
const MAX_ATTACHMENT_BYTES = 10 * 1024 // 10KB

function truncate(content: string): string {
  if (Buffer.byteLength(content, 'utf-8') <= MAX_ATTACHMENT_BYTES) {
    return content
  }

  const truncated = Buffer.from(content, 'utf-8').subarray(0, MAX_ATTACHMENT_BYTES).toString('utf-8')

  return `${truncated}\n\n...[truncated — exceeded ${MAX_ATTACHMENT_BYTES / 1024}KB limit]`
}

function stringifyBody(body: unknown): string | undefined {
  if (body === undefined) return undefined
  if (typeof body === 'string') return body

  try {
    return JSON.stringify(body, null, 2)
  } catch {
    return String(body)
  }
}

/**
 * Attaches the outgoing request body and the actual response body to the
 * currently running Playwright test, so both are visible in the HTML report
 * (and can later be pulled into a self-heal Jira bug ticket) without needing
 * to change every call site across the spec files.
 *
 * This is best-effort: if it's called outside of a running test (e.g. from a
 * setup script) or attaching otherwise fails, it silently no-ops rather than
 * breaking the actual request/response flow.
 */
async function attachRequestAndResponse(
  method: string,
  url: string,
  requestBody: unknown,
  response: APIResponse
): Promise<void> {
  try {
    const testInfo = test.info()

    const requestContent = stringifyBody(requestBody)
    if (requestContent !== undefined) {
      await testInfo.attach(`request-body (${method} ${url})`, {
        body: truncate(requestContent),
        contentType: 'application/json'
      })
    }

    let responseContent: string | undefined
    try {
      responseContent = await response.text()
    } catch {
      responseContent = undefined
    }

    if (responseContent !== undefined) {
      await testInfo.attach(`response-body (${response.status()} ${method} ${url})`, {
        body: truncate(responseContent),
        contentType: 'application/json'
      })
    }
  } catch {
    // Not running inside a test, or attach() failed — never let capture
    // break the actual API call.
  }
}

let cachedToken: string | undefined
let tokenLoaded = false

function getAuthToken(): string | undefined {
  if (tokenLoaded) return cachedToken

  try {
    const tokenFilePath = path.join(process.cwd(), 'playwright/.auth/api-token.json')
    const raw = fs.readFileSync(tokenFilePath, 'utf-8')
    cachedToken = JSON.parse(raw).access_token
  } catch {
    cachedToken = undefined
  }

  tokenLoaded = true
  return cachedToken
}

function withAuth<T extends {headers?: Record<string, string>}>(
  options?: WithNoAuth<T>
): Omit<T, 'noAuth'> & {headers: Record<string, string>} {
  const {noAuth, ...rest} = options ?? ({} as WithNoAuth<T>)

  if (noAuth) {
    return rest as Omit<T, 'noAuth'> & {headers: Record<string, string>}
  }

  const token = getAuthToken()
  const authHeader = token ? {Authorization: `Bearer ${token}`} : {}

  return {
    ...rest,
    headers: {
      ...authHeader,
      ...(rest as T).headers
    }
  } as Omit<T, 'noAuth'> & {headers: Record<string, string>}
}

/**
 * Extracts whatever the caller passed as the request "body" from a Playwright
 * request options object, checking the most common option keys in order.
 * Only one of these is ever meaningfully set per-request in this codebase.
 */
function extractRequestBody(options?: Record<string, unknown>): unknown {
  if (!options) return undefined
  return options.data ?? options.form ?? options.multipart ?? options.params
}

export async function apiGet(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['get']>[1]>
): Promise<APIResponse> {
  try {
    const response = await request.get(url, withAuth(options))
    await attachRequestAndResponse('GET', url, extractRequestBody(options as Record<string, unknown>), response)
    return response
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err)
    throw new Error(`GET ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`)
  }
}

export async function apiPost(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['post']>[1]>
): Promise<APIResponse> {
  try {
    const response = await request.post(url, withAuth(options))
    await attachRequestAndResponse('POST', url, extractRequestBody(options as Record<string, unknown>), response)
    return response
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err)
    throw new Error(`POST ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`)
  }
}

export async function apiPatch(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['patch']>[1]>
): Promise<APIResponse> {
  try {
    const response = await request.patch(url, withAuth(options))
    await attachRequestAndResponse('PATCH', url, extractRequestBody(options as Record<string, unknown>), response)
    return response
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err)
    throw new Error(`PATCH ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`)
  }
}

export async function apiPut(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['put']>[1]>
): Promise<APIResponse> {
  try {
    const response = await request.put(url, withAuth(options))
    await attachRequestAndResponse('PUT', url, extractRequestBody(options as Record<string, unknown>), response)
    return response
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err)
    throw new Error(`PUT ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`)
  }
}

export async function apiDelete(
  request: APIRequestContext,
  url: string,
  options?: WithNoAuth<Parameters<APIRequestContext['delete']>[1]>
): Promise<APIResponse> {
  try {
    const response = await request.delete(url, withAuth(options))
    await attachRequestAndResponse('DELETE', url, extractRequestBody(options as Record<string, unknown>), response)
    return response
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err)
    throw new Error(`DELETE ${url} failed at the network level — check connectivity/VPN. Cause: ${cause}`)
  }
}


