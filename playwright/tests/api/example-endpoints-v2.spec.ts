import {apiGet, assert401Schema} from '@functions/index'
import {APIRequestContext, APIResponse, expect, test} from '@playwright/test'

// TODO: Replace this file with your own spec files.
// Each spec file covers one logical group of endpoints (e.g. customer-endpoints-v2.spec.ts).
// Import your seed data from @seed-data/<category> and schema assertions from @schema-assertions/<category>.

test.describe('Example endpoints-V2', () => {
  test.describe('example-get-by-id', () => {
    const URL_STUB = 'example/by-id'

    test.describe('200 - Accepted', () => {
      let response: APIResponse
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 200').toBe(200)
      })

      test('Valid request with all required parameters', async ({request}: {request: APIRequestContext}) => {
        response = await apiGet(request, `${URL_STUB}/example-id`)
      })
    })

    test.describe('401 - Unauthorized', () => {
      test('Request with no auth token returns 401', async ({request}: {request: APIRequestContext}) => {
        const response = await apiGet(request, `${URL_STUB}/example-id`, {
          noAuth: true
        })
        expect(response.status(), 'Request should return 401').toBe(401)
        const body = await response.json()
        assert401Schema(body)
      })
    })
  })
})
