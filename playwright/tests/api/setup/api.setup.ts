import {expect, test as setup} from '@playwright/test'
import fs from 'fs'
import path from 'path'

interface TokenResponse {
  access_token: string
}

setup('authenticate', async ({request}) => {
  const CLIENT_ID = process.env.TEST_CLIENT_ID!
  const CLIENT_SECRET = process.env.TEST_CLIENT_SECRET!
  const TOKEN_URL = process.env.TEST_ACCESS_TOKEN_URL!
  const AUDIENCE = process.env.TEST_URL_AUTH!

  const response = await request.post(TOKEN_URL, {
    form: {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: AUDIENCE
    }
  })

  expect(response.status()).toBe(200)

  const body = (await response.json()) as TokenResponse

  expect(typeof body.access_token).toBe('string')

  const authDir = path.join(process.cwd(), 'playwright/.auth')
  fs.mkdirSync(authDir, {recursive: true})
  fs.writeFileSync(path.join(authDir, 'api-token.json'), JSON.stringify({access_token: body.access_token}))
})
