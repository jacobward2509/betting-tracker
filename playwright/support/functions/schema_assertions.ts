import {expect} from '@playwright/test'

export function assert400Schema(data: unknown): void {
  expect(data !== null && typeof data === 'object', 'Expect to be a object').toBe(true)

  const obj = data as Record<string, unknown>

  // Must have a 'details' string (both detailsOnly and standard error shapes)
  expect(typeof obj['details'], 'Expect message to be a string').toBe('string')
}

export function assert401Schema(data: unknown): void {
  expect(data !== null && typeof data === 'object', 'Expect to be a object').toBe(true)

  const obj = data as Record<string, unknown>

  expect(typeof obj['message'], 'Expect message to be a string').toBe('string')
  expect(obj.message, 'Expect message to be Unauthorized').toBe('Unauthorized')
}

export function assert403Schema(data: unknown): void {
  expect(data !== null && typeof data === 'object', 'Expect to be a object').toBe(true)

  const obj = data as Record<string, unknown>

  // Gateway explicit deny — either 'Message' or 'message' key
  const hasMessage = typeof obj['Message'] === 'string' || typeof obj['message'] === 'string'

  expect(hasMessage, '403 response must contain a Message or message string').toBe(true)
}

export function assert404Schema(data: unknown): void {
  expect(data !== null && typeof data === 'object', 'Expect to be a object').toBe(true)

  const obj = data as Record<string, unknown>

  expect(typeof obj['details'], 'Expect details to be a string').toBe('string')
  expect(typeof obj['error'], 'Expect error to be a string').toBe('string')
  expect(typeof obj['ts'], 'Expect ts to be a number').toBe('number')
}

export function assert422Schema(data: unknown): void {
  expect(data !== null && typeof data === 'object', 'Expect to be a object').toBe(true)

  const obj = data as Record<string, unknown>

  expect(typeof obj['details'], 'Expect details to be a string').toBe('string')
  expect(typeof obj['error'], 'Expect error to be a string').toBe('string')
  expect(typeof obj['ts'], 'Expect ts to be a number').toBe('number')
}

export function assert500Schema(data: unknown): void {
  expect(data !== null && typeof data === 'object', 'Expect to be a object').toBe(true)

  const obj = data as Record<string, unknown>

  expect(typeof obj['details'], 'Expect details to be a string').toBe('string')
  expect(typeof obj['error'], 'Expect error to be a string').toBe('string')
  expect(typeof obj['ts'], 'Expect ts to be a number').toBe('number')
}
