---
name: create-e2e-tests
description: Creates e2e tests following project patterns and conventions. Use when creating e2e tests, writing e2e tests, adding e2e tests, or when the user mentions end-to-end testing.
---

# Create E2E Tests

## Quick Start

When creating e2e tests, follow this workflow:

1. Determine the feature and module
2. Create test file in correct location
3. Set up NestJS app, config, and database client
4. Configure lifecycle hooks (beforeEach, afterEach, afterAll)
5. Write tests following Arrange-Act-Assert pattern
6. Use test factories for data creation
7. Clean up database tables after each test

## File Location Pattern

The correct location depends on whether the package is **flat** or **subdomain-based**.

### Detection rule

Look at the package folder structure:
- **Flat module** — no subdomain folders at the package root (e.g., `billing/`, `identity/`). The module has a single business area with one top-level module file.
- **Subdomain-based module** — contains named subdomain folders such as `ingestion/`, `aggregation/`, `reporting/`, `admin/`, `public-api/` (e.g., `analytics/`, `content/`).

### Flat modules (`billing`, `identity`, …)

```
package/{module}/__test__/e2e/{feature}/{feature}.spec.ts
```

- Module import: `'../../../{module}.module'` (3 levels up = package root)
- Config import: `'../../../config'` (3 levels up = package root)
- Factory import: `'../../factory/{factory}.test-factory'` (2 levels up = `__test__/`)

**Example locations:**
- `package/billing/__test__/e2e/subscription/subscription.spec.ts`
- `package/identity/__test__/e2e/auth/authentication.spec.ts`

### Subdomain-based modules (`analytics`, `content`, …)

```
package/{module}/{subdomain}/__test__/e2e/{feature}/{feature}.spec.ts
```

- Module import: `'../../../../{module}.module'` (4 levels up = package root)
- Config import: `'../../../../config'` (4 levels up = package root)
- Shared enum/service import: `'../../../../shared/...'` (4 levels up = package root)
- Factory import: `'../../../../__test__/factory/{factory}.test-factory'` (shared factories live at the package root `__test__/factory/`)

**Example locations:**
- `package/analytics/ingestion/__test__/e2e/ingestion/ingestion.spec.ts`
- `package/analytics/aggregation/__test__/e2e/aggregation/aggregation.spec.ts`
- `package/analytics/reporting/__test__/e2e/reporting/reporting.spec.ts`
- `package/analytics/public-api/__test__/e2e/facade/facade.spec.ts`
- `package/content/admin/__test__/e2e/admin/admin-movie.spec.ts`

<!-- Reference: See `folderStructure.mjs` lines 323-345 for the exact structure. -->

## Required Imports Template

### Flat module

```typescript
import { faker } from '@faker-js/faker';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { createNestApp, Tables } from '@asonseg/shared-lib/test';
import { ConfigModule, ConfigService } from '@asonseg/shared-module/config';
import { randomUUID } from 'crypto';
import knex, { Knex } from 'knex';
import nock, { cleanAll } from 'nock';
import request from 'supertest';
import { moduleConfigFactory, ModuleName } from '../../../module-name.module';
import { ModuleConfig } from '../../../config';
import { featureFactory } from '../../factory/feature.test-factory';
```

### Subdomain-based module

```typescript
import { faker } from '@faker-js/faker';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { createNestApp, Tables } from '@asonseg/shared-lib/test';
import { ConfigModule, ConfigService } from '@asonseg/shared-module/config';
import { randomUUID } from 'crypto';
import knex, { Knex } from 'knex';
import nock, { cleanAll } from 'nock';
import request from 'supertest';
import { moduleConfigFactory, ModuleName } from '../../../../module-name.module';
import { ModuleConfig } from '../../../../config';
import { featureFactory } from '../../../../__test__/factory/feature.test-factory';
```

Replace:
- `moduleConfigFactory` with your module's config factory (e.g., `analyticsConfigFactory`)
- `ModuleName` with your module class (e.g., `AnalyticsModule`)
- `ModuleConfig` with your config type (e.g., `AnalyticsConfig`)
- `feature.test-factory` with your test factory

## Setup Pattern (beforeAll)

Standard setup creates NestJS app, config service, and database client:

```typescript
describe('Feature e2e test', () => {
  let app: INestApplication;
  let module: TestingModule;
  let testDbClient: Knex;

  beforeAll(async () => {
    const nestTestSetup = await createNestApp([
      ConfigModule.forRoot({
        load: [moduleConfigFactory],
      }),
      ModuleName,
    ]);
    app = nestTestSetup.app;
    module = nestTestSetup.module;
    const configService = module.get<ConfigService<ModuleConfig>>(ConfigService);
    testDbClient = knex({
      client: 'pg',
      connection: `${configService.get('module.database.url')}`,
      searchPath: ['public'],
    });
  });
```

**Key points:**
- Use `createNestApp` from `@asonseg/shared-lib/test`
- Include `ConfigModule.forRoot` with your module's config factory
- Include your module in the imports array
- Extract `app` and `module` from the returned object
- Create Knex client using module's database URL from config
- Replace `module.database.url` with your module's config path (e.g., `billing.database.url`)

Reference: `package/billing/__test__/e2e/subscription/subscription.spec.ts` lines 27-42

## Lifecycle Hooks Pattern

### beforeEach

Set fake timers for date-dependent tests:

```typescript
beforeEach(async () => {
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2023-01-01'));
});
```

### afterEach

Clean up database tables in reverse dependency order (child tables first) and clear nock mocks:

```typescript
afterEach(async () => {
  await testDbClient(Tables.ChildTable).del();
  await testDbClient(Tables.ParentTable).del();
  cleanAll(); // Clear all nock mocks
});
```

**Important:** 
- Delete tables in reverse dependency order to avoid foreign key violations
- Always call `cleanAll()` to clear nock HTTP mocks after each test

### afterAll

Close app and module:

```typescript
afterAll(async () => {
  await app.close();
  module.close();
});
```

## JWT Mocking Pattern

For authenticated endpoints, mock JWT verification:

```typescript
const fakeUserId = faker.string.uuid();
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((_token: string, _secret: string, _options: unknown, callback: (err: Error | null, decoded: unknown) => void) => {
    callback(null, { sub: fakeUserId });
  }),
}));
```

Then use `Bearer fake-token` in Authorization headers:

```typescript
.set('Authorization', `Bearer fake-token`)
```

Reference: `package/billing/__test__/e2e/subscription/subscription.spec.ts` lines 15-20

## HTTP Mocking with Nock

For mocking external HTTP requests (API calls to third-party services or inter-module calls), use nock:

### Import

```typescript
import nock, { cleanAll } from 'nock';
```

### Basic Pattern

```typescript
nock('https://api.example.com', {
  encodedQueryParams: true,
  reqheaders: {
    Authorization: (): boolean => true, // Accept any authorization header
  },
})
  .defaultReplyHeaders({ 'access-control-allow-origin': '*' })
  .get('/endpoint')
  .query({ param: 'value' })
  .reply(200, {
    data: 'response',
  });
```

### Common Options

- **Base URL**: First argument is the base URL to mock
- **encodedQueryParams**: Set to `true` for query parameter encoding
- **reqheaders**: Object to match request headers (use functions for flexible matching)
- **defaultReplyHeaders**: Set CORS headers if needed
- **HTTP methods**: `.get()`, `.post()`, `.put()`, `.delete()`, etc.
- **query()**: Match query parameters
- **reply()**: Set response status code and body

### Example: Mocking External API

```typescript
it('calls external API', async () => {
  nock('https://api.themoviedb.org/3', {
    encodedQueryParams: true,
    reqheaders: {
      Authorization: (): boolean => true,
    },
  })
    .defaultReplyHeaders({ 'access-control-allow-origin': '*' })
    .get('/search/keyword')
    .query({
      query: 'Test Video',
      page: '1',
    })
    .reply(200, {
      results: [{ id: '1' }],
    });

  // Your test code that makes the HTTP request
  const res = await request(app.getHttpServer())
    .post('/admin/movie')
    .send({ title: 'Test Video' });

  expect(res.status).toBe(HttpStatus.CREATED);
});
```

### Example: Mocking Inter-Module Calls

```typescript
it('calls another module via HTTP', async () => {
  nock('https://localhost:3000', {
    encodedQueryParams: true,
    reqheaders: {
      Authorization: (): boolean => true,
    },
  })
    .defaultReplyHeaders({ 'access-control-allow-origin': '*' })
    .get(`/subscription/user/${userId}/active`)
    .reply(200, {
      isActive: true,
    });

  // Your test code
  const res = await request(app.getHttpServer())
    .get('/profile')
    .set('Authorization', `Bearer fake-token`);

  expect(res.status).toBe(HttpStatus.OK);
});
```

### Cleanup

Always clean up nock mocks in `afterEach`:

```typescript
afterEach(async () => {
  await testDbClient(Tables.TableName).del();
  cleanAll(); // Clear all nock mocks
});
```

**Important:**
- Call `cleanAll()` in `afterEach` to prevent mocks from leaking between tests
- Set up nock mocks before making the HTTP request in your test
- Use `encodedQueryParams: true` for query parameter matching
- Use function matchers in `reqheaders` for flexible header matching

Reference: 
- `package/content/admin/__test__/e2e/admin/admin-movie.spec.ts` lines 57-94
- `package/identity/__test__/e2e/auth/authentication.spec.ts` lines 169-179

## Test Structure Pattern

Follow Arrange-Act-Assert pattern:

```typescript
it('creates a resource', async () => {
  // Arrange: Set up test data
  const plan = planFactory.build({
    name: 'Basic',
    amount: 10.0,
  });
  await testDbClient(Tables.Plan).insert(plan);

  // Act: Make HTTP request
  const res = await request(app.getHttpServer())
    .post('/resource')
    .set('Authorization', `Bearer fake-token`)
    .send({ planId: plan.id });

  // Assert: Verify response
  expect(res.status).toBe(HttpStatus.CREATED);
  expect(res.body).toMatchObject({
    id: expect.any(String),
    planId: plan.id,
  });
});
```

**Best practices:**
- Use `describe` blocks to organize related tests
- Use test factories (`planFactory.build()`) instead of hardcoding data
- Insert test data using `testDbClient(Tables.TableName).insert()`
- Make requests using `request(app.getHttpServer())`
- Assert status codes using `HttpStatus` enum
- Use `expect.any(String)` for generated fields like IDs and timestamps

## Database Cleanup Pattern

Always clean up tables after each test using the `Tables` enum:

```typescript
afterEach(async () => {
  // Delete in reverse dependency order
  await testDbClient(Tables.InvoiceLineItem).del();
  await testDbClient(Tables.Invoice).del();
  await testDbClient(Tables.Subscription).del();
  await testDbClient(Tables.Plan).del();
});
```

**Rules:**
- Use `Tables` enum from `@asonseg/shared-lib/test`
- Delete child tables before parent tables
- Delete all tables used in the test
- Use `await` for all deletions

Reference: `package/billing/__test__/e2e/invoice/invoice.spec.ts` lines 51-56

## Examples

### Example 1: Simple CRUD Test

Reference: `package/billing/__test__/e2e/subscription/subscription.spec.ts`

```typescript
it('creates a subscription', async () => {
  const plan = planFactory.build({
    name: 'Basic',
    description: 'Basic monthly plan',
    currency: 'USD',
    amount: 10.0,
    interval: PlanInterval.Month,
    trialPeriod: 7,
  });
  await testDbClient(Tables.Plan).insert(plan);
  
  const res = await request(app.getHttpServer())
    .post('/subscription')
    .set('Authorization', `Bearer fake-token`)
    .send({ planId: plan.id });

  expect(res.status).toBe(HttpStatus.CREATED);
  expect(res.body).toEqual({
    id: expect.any(String),
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    deletedAt: null,
    endDate: null,
    userId: fakeUserId,
    planId: plan.id,
    status: SubscriptionStatus.Active,
    startDate: expect.any(String),
    autoRenew: true,
  });
});
```

### Example 2: Test with Relationships

Reference: `package/billing/__test__/e2e/invoice/invoice.spec.ts` lines 109-162

```typescript
it('should get invoice by id', async () => {
  // Arrange: Create plan, subscription, invoice with line items
  const plan = planFactory.build({
    name: 'Basic',
    amount: 10.0,
    interval: PlanInterval.Month,
  });
  await testDbClient(Tables.Plan).insert(plan);

  const subscription = subscriptionFactory.build({
    userId: fakeUserId,
    planId: plan.id,
    status: SubscriptionStatus.Active,
  });
  await testDbClient(Tables.Subscription).insert(subscription);

  const invoice = invoiceFactory.build({
    userId: fakeUserId,
    subscriptionId: subscription.id,
    status: InvoiceStatus.Open,
    subtotal: 10.0,
    totalTax: 1.0,
    total: 11.0,
    amountDue: 11.0,
  });
  await testDbClient(Tables.Invoice).insert(invoice);

  const lineItem = invoiceLineItemFactory.build({
    invoiceId: invoice.id,
    description: 'Basic Plan - Monthly',
    amount: 10.0,
    taxAmount: 1.0,
    totalAmount: 11.0,
  });
  await testDbClient(Tables.InvoiceLineItem).insert(lineItem);

  // Act: Get invoice by id
  const res = await request(app.getHttpServer())
    .get(`/invoices/${invoice.id}`)
    .set('Authorization', `Bearer fake-token`);

  // Assert
  expect(res.status).toBe(HttpStatus.OK);
  expect(res.body).toMatchObject({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: InvoiceStatus.Open,
    subtotal: 10.0,
    totalTax: 1.0,
    total: 11.0,
    amountDue: 11.0,
  });
});
```

### Example 3: Error Case Test

Reference: `package/billing/__test__/e2e/subscription/subscription.spec.ts` lines 89-95

```typescript
it('throws error if the plan does not exist', async () => {
  const res = await request(app.getHttpServer())
    .post('/subscription')
    .set('Authorization', `Bearer fake-token`)
    .send({ planId: randomUUID() });
  
  expect(res.status).toBe(HttpStatus.NOT_FOUND);
});
```

## Common Patterns

### Using Test Factories

```typescript
const plan = planFactory.build({
  name: 'Basic',
  amount: 10.0,
  interval: PlanInterval.Month,
});
```

Factories provide defaults but allow overrides. Use `build()` to create instances.

### Setting Fake Timers

```typescript
beforeEach(async () => {
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2023-01-01'));
});
```

Use for date-dependent tests to ensure consistent results.

### Testing with Authentication

```typescript
.set('Authorization', `Bearer fake-token`)
```

The JWT mock returns `fakeUserId` from the mock setup.

### Testing Error Responses

```typescript
expect(res.status).toBe(HttpStatus.NOT_FOUND);
expect(res.status).toBe(HttpStatus.BAD_REQUEST);
expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
```

Use `HttpStatus` enum for status codes.

### Mocking External HTTP Calls

Use nock to mock external API calls or inter-module HTTP calls:

```typescript
nock('https://api.example.com', {
  encodedQueryParams: true,
  reqheaders: {
    Authorization: (): boolean => true,
  },
})
  .defaultReplyHeaders({ 'access-control-allow-origin': '*' })
  .get('/endpoint')
  .query({ param: 'value' })
  .reply(200, { data: 'response' });
```

Always clean up with `cleanAll()` in `afterEach`.

## Anti-Patterns to Avoid

**Don't forget database cleanup:**
- Always clean up tables in `afterEach`
- Delete in reverse dependency order

**Don't use real timestamps:**
- Use fake timers in `beforeEach`
- Set a fixed date for consistency

**Don't hardcode IDs:**
- Use `faker.string.uuid()` or `randomUUID()`
- Use test factories for data creation

**Don't forget to close resources:**
- Always close app and module in `afterAll`
- Prevents resource leaks in test suite

**Don't forget to clean nock mocks:**
- Always call `cleanAll()` in `afterEach`
- Prevents HTTP mocks from leaking between tests

**Don't skip the ConfigModule:**
- Always include `ConfigModule.forRoot` with your config factory
- Required for database connection configuration

**Don't mix test data:**
- Each test should be independent
- Clean up all data after each test

## Additional Resources

- Test setup utility: `package/shared/lib/test/test-e2e.setup.ts`
- Tables enum: `package/shared/lib/test/enum/tables.enum.ts`
- Test factory example: `package/billing/__test__/factory/plan.test-factory.ts`
- Folder structure: `folderStructure.mjs` lines 323-345
