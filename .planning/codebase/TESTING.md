# Testing

## Framework and Runner

**Vitest** (`"vitest": "^2.1.4"`) is the test framework. It is configured at:
`/home/user/Claude-Code-Remote/kun-auto-chatbot/vitest.config.ts`

```ts
export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
```

**Key facts:**
- Test environment is `node` (not `jsdom`) — no browser APIs in tests
- Only `server/**/*.test.ts` and `server/**/*.spec.ts` are included
- Client-side React components are **not tested** — no frontend test files exist
- Run tests with: `pnpm test` (executes `vitest run`)

## Test File Locations

All test files live **co-located** with the server source they test. There is no separate `__tests__/` directory.

```
server/
  auth.logout.test.ts
  contextAwareDetection.test.ts
  cov-vehicle-detection.test.ts
  gender-detection.test.ts
  intentDetection.test.ts
  line-webhook.test.ts
  line.test.ts
  lineFlexTemplates.test.ts
  lineRichMenu.test.ts
  notify-recipients.test.ts
  phone-detection.test.ts
  security-cov.test.ts
  security.test.ts
  sync8891.test.ts
  timeSlot.test.ts
  vehicleDetection.test.ts
  vehicleDetectionV5.test.ts
  vehicles.test.ts
```

## Test File Structure

Every test file follows the same structure:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { functionUnderTest } from "./module";

describe("ModuleName", () => {
  describe("featureName", () => {
    it("should do specific thing", () => {
      expect(functionUnderTest(input)).toBe(expected);
    });
  });
});
```

- Imports are always explicit named imports from `vitest`
- Nested `describe` blocks group related cases (e.g., by intent type, by function)
- Test descriptions use `"should ..."` convention or plain English descriptions
- `it(...)` and `test(...)` are used interchangeably (both appear in the codebase)

## Mocking Approach

### Module Mocking with `vi.mock`

LLM and notification calls are mocked at the module level in integration tests:

```ts
// In vehicles.test.ts and line-webhook.test.ts
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "哈囉！..." } }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));
```

### Global Stub (`vi.stubGlobal`)

In `vehicles.test.ts`, `fetch` is stubbed globally to intercept LINE API calls:

```ts
vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, ...args: any[]) => {
  if (typeof url === 'string' && url.includes('api.line.me')) {
    return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
  }
  return originalFetch(url, ...args);
}));
```

### Environment Variable Tests

Some tests manipulate `process.env` directly and restore values in `afterEach`:

```ts
const originalEnv = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
afterEach(() => {
  process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS = originalEnv;
});
```

### No External Mocking Library

No `msw`, `nock`, or similar HTTP mocking libraries are used. HTTP interception is done with `vi.stubGlobal('fetch', ...)`.

## Test Patterns by Category

### Pure Function Tests (no mocking needed)

Used for deterministic logic: intent detection, phone number parsing, PII masking, time slots.

```ts
// server/phone-detection.test.ts
it("detects standard mobile number: 0912345678", () => {
  expect(detectPhoneNumber("我的電話是0912345678")).toBe("0912-345-678");
});
```

### Integration Tests via tRPC Caller

`vehicles.test.ts` and `sync8891.test.ts` test tRPC procedures end-to-end against the real database by creating caller instances with fake contexts:

```ts
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "admin-user", email: "admin@test.com",
      name: "Admin", loginMethod: "local", role: "admin",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const caller = appRouter.createCaller(ctx);
const vehicles = await caller.vehicle.list();
```

These tests require a real database connection (via `DATABASE_URL` env var). Tests that access the DB will pass only in environments with a configured database.

### Auth/Permission Tests

Auth boundary tests verify that protected procedures throw when called without credentials:

```ts
it("requires admin auth", async () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  await expect(caller.admin.dashboard({})).rejects.toThrow();
});
```

### CoV (Chain of Verification) Tests

A pattern unique to this codebase: test suites prefixed with `CoV` or `cov-` verify that security and detection mechanisms actually exist in source code (not just that they produce correct output):

```ts
// server/security-cov.test.ts
it("should have helmet imported in server entry", async () => {
  const serverEntry = fs.readFileSync(
    path.join(__dirname, "_core/index.ts"), "utf-8"
  );
  expect(serverEntry).toContain("helmet");
  expect(serverEntry).toContain("app.use(helmet");
});
```

These tests read `.ts` source files with `fs.readFileSync` and assert that specific patterns (imports, function calls) exist in the source text.

### Data-Driven Tests (forEach Pattern)

For intent detection, large arrays of example inputs are looped:

```ts
const appointmentMessages = [
  '可以明天約個看車時間嗎？',
  '我想平日上午去看車',
  // ...
];

appointmentMessages.forEach(msg => {
  it(`should detect appointment intent: "${msg}"`, () => {
    const intents = detectCustomerIntents(msg);
    expect(intents).toContain('appointment');
  });
});
```

### Mock Vehicle Fixtures

Vehicle tests create typed mock objects inline (not in shared fixtures files). Two patterns appear:

1. Full typed object with all nullable fields set to `null`:
   ```ts
   const mockVehicles: Vehicle[] = [
     {
       id: 1, externalId: "v1", brand: "BMW", model: "X1",
       manufactureYear: null, bodyType: null, licenseDate: null, location: null,
       // ... all fields
     }
   ];
   ```

2. Factory helper for generating many variants:
   ```ts
   function mockVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
     // returns base vehicle merged with overrides
   }
   ```

## Coverage

There is **no coverage configuration** in `vitest.config.ts`. Coverage is not collected or reported as part of the standard test run.

To run with coverage manually: `pnpm vitest run --coverage` (requires `@vitest/coverage-v8` or `@vitest/coverage-istanbul` — neither is listed as a dependency, so coverage is currently unsupported without installing one).

## What Is Not Tested

- **React components** — no frontend tests at all
- **Express middleware** — not unit tested; verified indirectly via CoV tests checking source
- **LLM responses** — always mocked; actual LLM behavior is not tested
- **Database migrations** — not tested; migrations are SQL files applied via `drizzle-kit`
- **8891 scraper HTTP requests** — external HTTP is mocked or skipped in CI
- **LINE API calls** — mocked via `vi.stubGlobal('fetch', ...)`

## Environment Requirements for Tests

Tests that use `appRouter.createCaller()` and actually hit the DB require:
- `DATABASE_URL` set to a MySQL connection string
- `JWT_SECRET` set (required by `security.ts` for encryption key derivation)
- `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_OWNER_USER_ID` set (tested in `line.test.ts` and `line-webhook.test.ts`)
- `LINE_ADDITIONAL_NOTIFY_USER_IDS` set (tested in `notify-recipients.test.ts`)

Pure function tests (intent detection, phone detection, PII masking, etc.) have no environment requirements.
