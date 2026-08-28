import { apiGet, apiPost } from '@functions/index';
import {
  assertErrorResponseSchema,
  assertLoginSchema,
  assertSignupSchema,
} from '@schema-assertions/auth';
import {
  maximumLoginBody,
  maximumSignupBody,
  randomSignupEmail,
  VALID_SIGNUP_PASSWORD,
  type LoginRequestBody,
  type SignupRequestBody,
} from '@seed-data/auth';

import { APIRequestContext, APIResponse, expect, test } from '@playwright/test';
import fs from 'fs';

test.describe('Auth endpoints-V2', () => {
  test.describe('signup', () => {
    const URL_STUB = 'api/auth/signup';
    let requestBody: any;

    test.beforeEach(() => {
      requestBody = maximumSignupBody();
    });

    test.describe('201 - Accepted', () => {
      // Serial: "Valid request with all fields" writes its signup response to
      // the shared auth-variables.json dynamic test data file, and
      // "Validate signup via GET request" reads it back — running serially
      // avoids concurrent writes without needing file locking.
      test.describe.configure({ mode: 'serial' });

      let response: APIResponse;

      test('Valid request with all fields', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiPost(request, URL_STUB, {
          data: requestBody,
          noAuth: true,
        });
        expect(response.status(), 'Request should return 201').toBe(201);
        const body = await response.json();
        assertSignupSchema(body);
        // Record the seeded account for the dedicated DELETE /api/auth/me test
        // suite to consume and clean up later — cleanup is intentionally
        // deferred there, not performed in this suite.
        fs.writeFileSync(
          `support/dynamic-test-data/auth-variables.json`,
          JSON.stringify({
            email: requestBody.email,
            password: requestBody.password,
            token: body.token,
            userId: body.user.id,
          }),
        );
      });

      test('Validate signup via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const authVars = JSON.parse(
          fs.readFileSync(
            `support/dynamic-test-data/auth-variables.json`,
            'utf-8',
          ),
        );

        response = await apiGet(request, 'api/auth/me', {
          headers: { Authorization: `Bearer ${authVars.token}` },
          noAuth: true,
        });

        expect(response.status(), 'GET /api/auth/me should return 200').toBe(
          200,
        );
        const body = await response.json();
        expect(body.user?.id, 'Returned user id matches signup response').toBe(
          authVars.userId,
        );
        expect(
          body.user?.email,
          'Returned user email matches signup response',
        ).toBe(authVars.email);
      });
    });

    test.describe('400 - Bad Request', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 400').toBe(400);
        const body = await response.json();
        assertErrorResponseSchema(body);
      });

      test.describe('Missing Mandatory Data', () => {
        test('Missing request body', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          response = await apiPost(request, URL_STUB, {
            data: {},
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
        });

        test('Missing name field', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          delete requestBody.name;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Name is required.',
          );
        });

        test('Missing email field', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          delete requestBody.email;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email is required.',
          );
        });

        test('Missing password field', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          delete requestBody.password;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password is required.',
          );
        });
      });

      test.describe('Invalid Data Types', () => {
        test('name is NULL', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.name = null;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Name is required.',
          );
        });

        test('name as an Empty String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.name = '';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Name must be at least 2 characters long.',
          );
        });

        test('name as a Number', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.name = 12345;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Name is required.',
          );
        });

        test('name below minimum length', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.name = 'a';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Name must be at least 2 characters long.',
          );
        });

        test('name above maximum length', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.name = 'a'.repeat(61);
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Name must be at most 60 characters long.',
          );
        });

        test('email is NULL', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = null;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email is required.',
          );
        });

        test('email as an Empty String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = '';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Please provide a valid email address.',
          );
        });

        test('email as a Number', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = 12345;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email is required.',
          );
        });

        test('Invalid email format', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = 'jane.doe@example';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Please provide a valid email address.',
          );
        });

        test('email above maximum length', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = `${'a'.repeat(246)}@example.com`;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email must be at most 254 characters long.',
          );
        });

        test('password is NULL', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = null;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password is required.',
          );
        });

        test('password as an Empty String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = '';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password must be at least 10 characters long.',
          );
        });

        test('password as a Number', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = 12345678901;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password is required.',
          );
        });

        test('password below minimum length', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = '123456789';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password must be at least 10 characters long.',
          );
        });

        test('password above maximum length', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = 'a'.repeat(73);
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password must be at most 72 characters long.',
          );
        });

        test('Unrecognized field present', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const invalidBody: Record<string, unknown> = {
            ...requestBody,
            preferences: { defaultStake: 5 },
          };
          response = await apiPost(request, URL_STUB, {
            data: invalidBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
        });
      });

      test.describe('Cross-Field Validation', () => {
        test('Duplicate email — account already exists', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const firstResponse = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });
          expect(
            firstResponse.status(),
            'Initial signup should succeed with 201',
          ).toBe(201);

          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'ACCOUNT_EXISTS',
          );
          expect(body.error.message, 'Error message is correct').toBe(
            'An account with this email already exists.',
          );
        });

        test('Duplicate email — case-insensitive match', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const firstResponse = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });
          expect(
            firstResponse.status(),
            'Initial signup should succeed with 201',
          ).toBe(201);

          const duplicateBody: SignupRequestBody = {
            ...requestBody,
            email: requestBody.email.toUpperCase(),
          };
          response = await apiPost(request, URL_STUB, {
            data: duplicateBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'ACCOUNT_EXISTS',
          );
          expect(body.error.message, 'Error message is correct').toBe(
            'An account with this email already exists.',
          );
        });
      });
    });

    test.describe('413 - Payload Too Large', () => {
      test('Request body exceeds size limit', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const oversizedBody: SignupRequestBody = {
          ...maximumSignupBody(),
          password: 'a'.repeat(20000),
        };

        const response = await apiPost(request, URL_STUB, {
          data: oversizedBody,
          noAuth: true,
        });

        expect(response.status(), 'Request should return 413').toBe(413);
        const body = await response.json();
        expect(body.error.code, 'Error code is correct').toBe(
          'PAYLOAD_TOO_LARGE',
        );
        assertErrorResponseSchema(body);
      });
    });
  });

  test.describe('login', () => {
    const URL_STUB = 'api/auth/login';
    const SIGNUP_URL_STUB = 'api/auth/signup';
    let registeredEmail: string;
    let requestBody: any;

    // Creates the account each login test logs into via the signup seed-data
    // builder (maximumSignupBody()) — the email/password every login test uses
    // are exactly what that builder returns, never re-declared or hardcoded here.
    test.beforeEach(async ({ request }: { request: APIRequestContext }) => {
      const signupBody = maximumSignupBody();
      const signupResponse = await apiPost(request, SIGNUP_URL_STUB, {
        data: signupBody,
        noAuth: true,
      });
      expect(
        signupResponse.status(),
        'Setup signup should succeed with 201',
      ).toBe(201);

      registeredEmail = signupBody.email;
      requestBody = maximumLoginBody(registeredEmail, signupBody.password);
    });

    test.describe('200 - Accepted', () => {
      // Serial: "Valid request with all fields" writes its login response to
      // the shared login-variables.json dynamic test data file, and
      // "Validate login via GET request" reads it back — running serially
      // avoids concurrent writes without needing file locking. Mirrors the
      // signup 201 block's pattern above for the same reason.
      test.describe.configure({ mode: 'serial' });

      let response: APIResponse;

      test('Valid request with all fields', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiPost(request, URL_STUB, {
          data: requestBody,
          noAuth: true,
        });
        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertLoginSchema(body);
        // Record the login response for the following GET-validation test to
        // consume.
        fs.writeFileSync(
          `support/dynamic-test-data/login-variables.json`,
          JSON.stringify({
            token: body.token,
            userId: body.user.id,
            email: body.user.email,
          }),
        );
      });

      test('Validate login via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const loginVars = JSON.parse(
          fs.readFileSync(
            `support/dynamic-test-data/login-variables.json`,
            'utf-8',
          ),
        );

        response = await apiGet(request, 'api/auth/me', {
          headers: { Authorization: `Bearer ${loginVars.token}` },
          noAuth: true,
        });

        expect(response.status(), 'GET /api/auth/me should return 200').toBe(
          200,
        );
        const body = await response.json();
        expect(body.user?.id, 'Returned user id matches login response').toBe(
          loginVars.userId,
        );
        expect(
          body.user?.email,
          'Returned user email matches login response',
        ).toBe(loginVars.email);
      });

      test('Login succeeds with differently-cased email', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const casedBody: LoginRequestBody = {
          ...requestBody,
          email: registeredEmail.toUpperCase(),
        };
        response = await apiPost(request, URL_STUB, {
          data: casedBody,
          noAuth: true,
        });
        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertLoginSchema(body);
      });
    });

    test.describe('400 - Bad Request', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 400').toBe(400);
        const body = await response.json();
        assertErrorResponseSchema(body);
      });

      test.describe('Missing Mandatory Data', () => {
        test('Missing request body', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          response = await apiPost(request, URL_STUB, {
            data: {},
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
        });

        test('Missing email field', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          delete requestBody.email;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email is required.',
          );
        });

        test('Missing password field', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          delete requestBody.password;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password is required.',
          );
        });
      });

      test.describe('Invalid Data Types', () => {
        test('email is NULL', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = null;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email is required.',
          );
        });

        test('email as an Empty String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = '';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Please provide a valid email address.',
          );
        });

        test('email as a Number', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = 12345;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email is required.',
          );
        });

        test('Invalid email format', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = 'jane.doe@example';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Please provide a valid email address.',
          );
        });

        test('email above maximum length', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.email = `${'a'.repeat(246)}@example.com`;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Email must be at most 254 characters long.',
          );
        });

        test('password is NULL', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = null;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password is required.',
          );
        });

        test('password as an Empty String', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = '';
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password is required.',
          );
        });

        test('password as a Number', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = 12345678901;
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password is required.',
          );
        });

        test('password above maximum length', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.password = 'a'.repeat(73);
          response = await apiPost(request, URL_STUB, {
            data: requestBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
          expect(body.error.fields[0].message, 'Error message is correct').toBe(
            'Password must be at most 72 characters long.',
          );
        });

        test('Unrecognized field present', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const invalidBody: Record<string, unknown> = {
            ...requestBody,
            rememberMe: true,
          };
          response = await apiPost(request, URL_STUB, {
            data: invalidBody,
            noAuth: true,
          });

          const body = await response.json();
          expect(body.error.code, 'Error code is correct').toBe(
            'VALIDATION_ERROR',
          );
        });
      });
    });

    test.describe('401 - Unauthorized', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        assertErrorResponseSchema(body);
        expect(body.error.code, 'Error code is correct').toBe(
          'INVALID_CREDENTIALS',
        );
        expect(body.error.message, 'Error message is correct').toBe(
          'Invalid email or password.',
        );
      });

      test('Unknown email', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const unknownBody: LoginRequestBody = maximumLoginBody(
          randomSignupEmail(),
          VALID_SIGNUP_PASSWORD,
        );
        response = await apiPost(request, URL_STUB, {
          data: unknownBody,
          noAuth: true,
        });
      });

      test('Correct email, incorrect password', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const wrongPasswordBody: LoginRequestBody = {
          ...requestBody,
          password: `${VALID_SIGNUP_PASSWORD}-wrong`,
        };
        response = await apiPost(request, URL_STUB, {
          data: wrongPasswordBody,
          noAuth: true,
        });
      });

      test('Identical error for unknown email vs wrong password', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const unknownEmailResponse = await apiPost(request, URL_STUB, {
          data: maximumLoginBody(randomSignupEmail(), VALID_SIGNUP_PASSWORD),
          noAuth: true,
        });
        const wrongPasswordResponse = await apiPost(request, URL_STUB, {
          data: { ...requestBody, password: `${VALID_SIGNUP_PASSWORD}-wrong` },
          noAuth: true,
        });

        const unknownEmailBody = await unknownEmailResponse.json();
        const wrongPasswordBody = await wrongPasswordResponse.json();

        expect(
          unknownEmailResponse.status(),
          'Unknown email should return 401',
        ).toBe(401);
        expect(
          wrongPasswordResponse.status(),
          'Wrong password should return 401',
        ).toBe(401);
        expect(unknownEmailBody.error.code, 'Error codes match').toBe(
          wrongPasswordBody.error.code,
        );
        expect(unknownEmailBody.error.message, 'Error messages match').toBe(
          wrongPasswordBody.error.message,
        );

        response = wrongPasswordResponse;
      });
    });

    test.describe('413 - Payload Too Large', () => {
      test('Request body exceeds size limit', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const oversizedBody: LoginRequestBody = {
          ...requestBody,
          password: 'a'.repeat(20000),
        };

        const response = await apiPost(request, URL_STUB, {
          data: oversizedBody,
          noAuth: true,
        });

        expect(response.status(), 'Request should return 413').toBe(413);
        const body = await response.json();
        expect(body.error.code, 'Error code is correct').toBe(
          'PAYLOAD_TOO_LARGE',
        );
        assertErrorResponseSchema(body);
      });
    });
  });
});
