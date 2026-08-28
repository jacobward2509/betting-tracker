import fs from 'fs';
import path from 'path';

export interface SeededUser {
  email: string;
  password: string;
  token: string;
  userId: string;
}

const SEEDED_USERS_FILE = path.join(
  process.cwd(),
  'support/dynamic-test-data/seeded-users.json',
);

/**
 * Appends a seeded user (created via POST /api/auth/signup in the API test
 * suite) to a shared, gitignored JSON file so a future dedicated
 * DELETE /api/auth/me test suite has real, pre-existing accounts to exercise.
 * Cleanup of these accounts is intentionally deferred to that suite — this
 * file only records them, it does not delete anything.
 *
 * Appends rather than overwrites, since multiple tests write to the same file
 * across a single run. The describe block calling this is run in serial mode
 * (test.describe.configure({ mode: 'serial' })), so no file locking is
 * needed here — tests never write concurrently.
 */
export function appendSeededUser(user: SeededUser): void {
  fs.mkdirSync(path.dirname(SEEDED_USERS_FILE), { recursive: true });

  let existing: SeededUser[] = [];
  try {
    existing = JSON.parse(fs.readFileSync(SEEDED_USERS_FILE, 'utf-8'));
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }

  existing.push(user);
  fs.writeFileSync(SEEDED_USERS_FILE, JSON.stringify(existing, null, 2));
}
