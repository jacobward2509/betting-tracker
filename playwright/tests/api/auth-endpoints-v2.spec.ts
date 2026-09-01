import { apiDelete, apiGet, apiPatch, apiPost, deleteAccount } from '@functions/index';
import {
  assertCurrentUserSchema,
  assertErrorResponseSchema,
  assertLoginSchema,
  assertSignupSchema,
} from '@schema-assertions/auth';
import {
  maximumLoginBody,
  maximumSignupBody,
  maximumUpdateProfileBody,
  randomSignupEmail,
  VALID_SIGNUP_PASSWORD,
  type LoginRequestBody,
  type SignupRequestBody,
} from '@seed-data/auth';

import { APIRequestContext, APIResponse, expect, test } from '@playwright/test';

test.describe('Auth endpoints-V2', () => {
  test.describe('signup', () => {
    const URL_STUB = 'api/auth/signup';
    let requestBody: any;

    test.beforeEach(() => {
      requestBody = maximumSignupBody();
    });

    test.describe('201 - Accepted', () => {
      // Serial: "Valid request with all fields" captures its signup response
      // in a shared closure variable, and "Validate signup via GET request"
      // reads it back — running serially avoids the two tests racing on the
      // same account.
      test.describe.configure({ mode: 'serial' });

      let response: APIResponse;
      let signupResponseBody: { token: string; user: { id: string; email: string } };

      test.afterAll(async ({ request }: { request: APIRequestContext }) => {
        // Cleans up the account created by "Valid request with all fields"
        // and reused by "Validate signup via GET request" — runs once both
        // serial tests in this block have finished with it.
        if (signupResponseBody?.token) {
          await deleteAccount(request, signupResponseBody.token);
        }
      });

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
        signupResponseBody = body;
      });

      test('Validate signup via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, 'api/auth/me', {
          headers: { Authorization: `Bearer ${signupResponseBody.token}` },
          noAuth: true,
        });

        expect(response.status(), 'GET /api/auth/me should return 200').toBe(
          200,
        );
        const body = await response.json();
        expect(body.user.id, 'Returned user id matches signup response').toBe(
          signupResponseBody.user.id,
        );
        expect(
          body.user.email,
          'Returned user email matches signup response',
        ).toBe(signupResponseBody.user.email);
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
        let createdAccountToken: string;

        test.afterEach(async ({ request }: { request: APIRequestContext }) => {
          // Cleans up the account created by the initial successful signup
          // in each test below, before the (rejected) duplicate attempt.
          await deleteAccount(request, createdAccountToken);
        });

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
          const firstResponseBody = await firstResponse.json();
          createdAccountToken = firstResponseBody.token;

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
          const firstResponseBody = await firstResponse.json();
          createdAccountToken = firstResponseBody.token;

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
    let signupToken: string;
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
      const signupResponseBody = await signupResponse.json();
      signupToken = signupResponseBody.token;

      registeredEmail = signupBody.email;
      requestBody = maximumLoginBody(registeredEmail, signupBody.password);
    });

    test.afterEach(async ({ request }: { request: APIRequestContext }) => {
      // Cleans up the account seeded above for every test in this describe
      // (200/400/401/413), consistent with the getCurrentUser suite's
      // beforeEach/afterEach cleanup pattern.
      await deleteAccount(request, signupToken);
    });

    test.describe('200 - Accepted', () => {
      // Serial: "Valid request with all fields" and "Validate login via GET
      // request" share one account across two tests, so they need their own
      // beforeAll/afterAll-scoped account rather than the outer per-test
      // beforeEach/afterEach above — that per-test account gets deleted right
      // after each test, which would break the pair sharing a single login
      // response's token. "Login succeeds with differently-cased email" also
      // shares this account for consistency, since it just needs a second
      // valid login against the same registered email.
      test.describe.configure({ mode: 'serial' });

      let response: APIResponse;
      let loginResponseBody: { token: string; user: { id: string; email: string } };
      let sharedSignupBody: SignupRequestBody;
      let sharedSignupToken: string;

      test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
        sharedSignupBody = maximumSignupBody();
        const signupResponse = await apiPost(request, SIGNUP_URL_STUB, {
          data: sharedSignupBody,
          noAuth: true,
        });
        const signupResponseBody = await signupResponse.json();
        sharedSignupToken = signupResponseBody.token;
      });

      test.afterAll(async ({ request }: { request: APIRequestContext }) => {
        await deleteAccount(request, sharedSignupToken);
      });

      test('Valid request with all fields', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const loginBody = maximumLoginBody(
          sharedSignupBody.email,
          sharedSignupBody.password,
        );
        response = await apiPost(request, URL_STUB, {
          data: loginBody,
          noAuth: true,
        });
        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertLoginSchema(body);
        loginResponseBody = body;
      });

      test('Validate login via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, 'api/auth/me', {
          headers: { Authorization: `Bearer ${loginResponseBody.token}` },
          noAuth: true,
        });

        expect(response.status(), 'GET /api/auth/me should return 200').toBe(
          200,
        );
        const body = await response.json();
        expect(body.user.id, 'Returned user id matches login response').toBe(
          loginResponseBody.user.id,
        );
        expect(
          body.user.email,
          'Returned user email matches login response',
        ).toBe(loginResponseBody.user.email);
      });

      test('Login succeeds with differently-cased email', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const casedBody: LoginRequestBody = maximumLoginBody(
          sharedSignupBody.email.toUpperCase(),
          sharedSignupBody.password,
        );
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

  test.describe('getCurrentUser', () => {
    const URL_STUB = 'api/auth/me';

    test.describe('200 - Accepted', () => {
      let token: string;
      let signupBody: SignupRequestBody;
      let response: APIResponse;

      test.beforeEach(async ({ request }: { request: APIRequestContext }) => {
        signupBody = maximumSignupBody();
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: signupBody,
          noAuth: true,
        });
        const signupResponseBody = await signupResponse.json();
        token = signupResponseBody.token;
      });

      test.afterEach(async ({ request }: { request: APIRequestContext }) => {
        // Cleans up the account seeded in beforeEach, consistent with the
        // signup/login suites deferring cleanup to a dedicated DELETE
        // /api/auth/me call rather than leaving accounts to leak.
        await deleteAccount(request, token);
      });

      test('Valid request returns the authenticated user', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, URL_STUB, {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertCurrentUserSchema(body);
        expect(body.user.name, 'Returned user name matches signup').toBe(
          signupBody.name,
        );
        expect(body.user.email, 'Returned user email matches signup').toBe(
          signupBody.email,
        );
      });
    });

    test.describe('401 - Unauthorized', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/auth/test-plan-get-current-user.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });

      test('Missing auth header', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, URL_STUB, { noAuth: true });
      });
    });
  });

  test.describe('deleteCurrentAccount', () => {
    const URL_STUB = 'api/auth/me';

    test.describe('204 - Accepted', () => {
      // Serial: "Valid request deletes the current user's account" seeds and
      // deletes the account, and "Validate account deletion via GET request"
      // reuses the same (now-deleted) account's token to confirm the delete
      // actually took effect — running serially avoids the two tests racing
      // on the same account.
      test.describe.configure({ mode: 'serial' });

      let token: string;

      test('Valid request deletes the current user\'s account', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const signupBody = maximumSignupBody();
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: signupBody,
          noAuth: true,
        });
        const signupResponseBody = await signupResponse.json();
        token = signupResponseBody.token;

        const response = await apiDelete(request, URL_STUB, {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });

        expect(response.status(), 'Request should return 204').toBe(204);
        const body = await response.text();
        expect(body, 'Response body should be empty').toBe('');
      });

      test('Validate account deletion via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const response = await apiGet(request, URL_STUB, {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });

        expect(
          response.status(),
          'GET /api/auth/me should return 401 for the deleted account',
        ).toBe(401);
        const body = await response.json();
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/auth/test-plan-delete-current-account.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });
    });

    test.describe('401 - Unauthorized', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/auth/test-plan-delete-current-account.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });

      test('Missing auth header', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiDelete(request, URL_STUB, { noAuth: true });
      });

      test('Re-deleting an already-deleted account (stale token)', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const signupBody = maximumSignupBody();
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: signupBody,
          noAuth: true,
        });
        const signupResponseBody = await signupResponse.json();
        const token = signupResponseBody.token;

        const firstDeleteResponse = await apiDelete(request, URL_STUB, {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });
        expect(
          firstDeleteResponse.status(),
          'First delete should return 204',
        ).toBe(204);

        response = await apiDelete(request, URL_STUB, {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });
      });
    });
  });

  test.describe('logout', () => {
    const URL_STUB = 'api/auth/logout';

    test.describe('204 - Accepted', () => {
      // Serial: "Valid request invalidates the current session" logs out the
      // account, and "Validate logout via GET request" reuses the same
      // (now-invalidated) token to confirm the session no longer
      // authenticates — running serially avoids the two tests racing on the
      // same account.
      test.describe.configure({ mode: 'serial' });

      let signupBody: SignupRequestBody;
      let token: string;

      test.afterAll(async ({ request }: { request: APIRequestContext }) => {
        // Logout invalidates `token`, so re-login with the same seeded
        // credentials to obtain a fresh token, then delete the account so
        // it isn't left behind in the environment.
        const loginResponse = await apiPost(request, 'api/auth/login', {
          data: { email: signupBody.email, password: signupBody.password },
          noAuth: true,
        });
        const loginResponseBody = await loginResponse.json();
        await deleteAccount(request, loginResponseBody.token);
      });

      test('Valid request invalidates the current session', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        signupBody = maximumSignupBody();
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: signupBody,
          noAuth: true,
        });
        const signupResponseBody = await signupResponse.json();
        token = signupResponseBody.token;

        const response = await apiPost(request, URL_STUB, {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });

        expect(response.status(), 'Request should return 204').toBe(204);
        const body = await response.text();
        expect(body, 'Response body should be empty').toBe('');
      });

      test('Validate logout via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const response = await apiGet(request, 'api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });

        expect(
          response.status(),
          'GET /api/auth/me should return 401 for the logged-out session',
        ).toBe(401);
        const body = await response.json();
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/auth/test-plan-logout.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });
    });

    test.describe('401 - Unauthorized', () => {
      let response: APIResponse;
      test.afterEach(async () => {
        expect(response.status(), 'Request should return 401').toBe(401);
        const body = await response.json();
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/auth/test-plan-logout.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });

      test('Missing auth header', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiPost(request, URL_STUB, { noAuth: true });
      });
    });
  });

  test.describe('updateProfile', () => {
    const URL_STUB = 'api/auth/me';

    test.describe('200 - Accepted', () => {

      // Serial: "Valid request with all fields" captures its PATCH response in
      // a shared closure variable, and "Validate update via GET request"
      // reads it back — running serially avoids the two tests racing on the
      // same account.
      test.describe.configure({ mode: 'serial' });

      let token: string;
      let updatedName: string;
      let response: APIResponse;

      test.afterAll(async ({ request }: { request: APIRequestContext }) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test('Valid request with all fields', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: maximumSignupBody(),
          noAuth: true,
        });
        const signupResponseBody = await signupResponse.json();
        token = signupResponseBody.token;

        const requestBody = maximumUpdateProfileBody();
        updatedName = requestBody.name;

        response = await apiPatch(request, URL_STUB, {
          data: requestBody,
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });

        expect(response.status(), 'Request should return 200').toBe(200);
        const body = await response.json();
        assertCurrentUserSchema(body);
        expect(body.user.name, 'Returned user name matches the update').toBe(
          updatedName,
        );
      });

      test('Validate update via GET request', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiGet(request, URL_STUB, {
          headers: { Authorization: `Bearer ${token}` },
          noAuth: true,
        });

        expect(response.status(), 'GET /api/auth/me should return 200').toBe(
          200,
        );
        const body = await response.json();
        expect(
          body.user.name,
          'Returned user name matches the persisted update',
        ).toBe(updatedName);
      });
    });

    test.describe('400 - Bad Request', () => {
      let token: string;
      let response: APIResponse;
      let requestBody: any;

      test.beforeEach(async ({ request }: { request: APIRequestContext }) => {
        const signupResponse = await apiPost(request, 'api/auth/signup', {
          data: maximumSignupBody(),
          noAuth: true,
        });
        const signupResponseBody = await signupResponse.json();
        token = signupResponseBody.token;
        requestBody = maximumUpdateProfileBody();
      });

      test.afterEach(async () => {
        expect(response.status(), 'Request should return 400').toBe(400);
        const body = await response.json();
        assertErrorResponseSchema(body);
      });

      test.afterEach(async ({ request }: { request: APIRequestContext }) => {
        if (token) {
          await deleteAccount(request, token);
        }
      });

      test.describe('Missing Mandatory Data', () => {
        test('Missing name field (empty request body)', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          response = await apiPatch(request, URL_STUB, {
            data: {},
            headers: { Authorization: `Bearer ${token}` },
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
      });

      test.describe('Invalid Data Types', () => {
        test('name is NULL', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          requestBody.name = null;
          response = await apiPatch(request, URL_STUB, {
            data: requestBody,
            headers: { Authorization: `Bearer ${token}` },
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
          response = await apiPatch(request, URL_STUB, {
            data: requestBody,
            headers: { Authorization: `Bearer ${token}` },
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
          response = await apiPatch(request, URL_STUB, {
            data: requestBody,
            headers: { Authorization: `Bearer ${token}` },
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
          response = await apiPatch(request, URL_STUB, {
            data: requestBody,
            headers: { Authorization: `Bearer ${token}` },
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
          response = await apiPatch(request, URL_STUB, {
            data: requestBody,
            headers: { Authorization: `Bearer ${token}` },
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

        test('Unrecognized field present', async ({
          request,
        }: {
          request: APIRequestContext;
        }) => {
          const invalidBody: Record<string, unknown> = {
            ...requestBody,
            role: 'admin',
          };
          response = await apiPatch(request, URL_STUB, {
            data: invalidBody,
            headers: { Authorization: `Bearer ${token}` },
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
        // Deviates from the documented ErrorResponse schema — requireAuth
        // returns a plain string error, not the structured { code, message }
        // shape. See "Scope Notes" in
        // docs/test-plans/api/auth/test-plan-update-profile.md.
        expect(body.error, 'Error message is correct').toBe('Unauthorized');
      });

      test('Missing auth header', async ({
        request,
      }: {
        request: APIRequestContext;
      }) => {
        response = await apiPatch(request, URL_STUB, {
          data: maximumUpdateProfileBody(),
          noAuth: true,
        });
      });
    });
  });
});

