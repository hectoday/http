# Hectoday HTTP

> **A minimal, explicit web framework built on Web Standards.**

Hectoday HTTP is designed around one core idea:

> **The framework describes facts. You decide what HTTP means.**

No hidden control flow. No magic responses. No implicit error handling.

If a request ends, it's because **you returned a `Response`** or a **guard
explicitly denied it.**

---

# Philosophy

Hectoday HTTP is built for:

- Learnability
- Explicit control flow
- Deterministic behavior
- Web platform first (Fetch API)
- Edge compatibility (Deno, Bun, Workers)

### Design laws

1. **One decision boundary**
   Only handlers and guards can end a request.

3. **No hidden branching**
   Nothing auto-returns 400/401/403 for you.

5. **Facts before decisions**
   The framework computes:

   - raw inputs
   - validation results
   - guard facts

   You decide what they mean.

7. **Errors are responses**
   Expected failures are returned explicitly.

9. **Unexpected failures throw**
    Bugs go to one error boundary.

---

# High-level lifecycle

```
Request
   ↓
onRequest (locals only)
   ↓
Route match
   ↓
Extract raw inputs
   ↓
Parse body (if schema exists)
   ↓
Validate (if schemas defined)
   ↓
Guards (allow / deny)
   ↓
Handler (returns Response)
   ↓
onResponse
   ↓
Response
```

---

# Mental model

```
Facts → Gates → Decision
```

- **Facts**

  - `c.raw`
  - `c.input`
  - `c.locals`

- **Gates**

  - guards (allow / deny)

- **Decision**

  - handler returns Response

---

# Installation

npm:

```bash
npx jsr add @hectoday/http
```

deno:

```
deno add jsr:@hectoday/http
```

bun:

```bash
bunx jsr add @hectoday/http
```

---

# Basic example

```ts
import { route, setupHttp } from "@hectoday/http";

const app = setupHttp({
  handlers: [
    route.get("/hello", {
      resolve: () => new Response("Hello world"),
    }),
  ],
});

Deno.serve(app.fetch);
```

---

# Core API

## `setupHttp()`

```ts
const handler = setupHttp({
  handlers,
  validator,
  onRequest,
  onResponse,
  onError,
});
```

### Options

| Name         | Type                           | Description                                   |
| ------------ | ------------------------------ | --------------------------------------------- |
| `handlers`   | `Handler[]`                    | All registered handlers                       |
| `validator`  | `Validator<TSchema>`           | Schema adapter (required if using validation) |
| `onRequest`  | `(req) => void \| LocalsPatch` | Runs **before routing**                       |
| `onResponse` | `(c, res) => Response`         | Runs before returning response                |
| `onError`    | `(err, c) => Response`         | Global error handler                          |

Returns:

```ts
{
  fetch: ((req: Request) => Promise<Response>);
}
```

Compatible with:

- Deno
- Bun
- Cloudflare Workers
- Node (fetch runtimes)

---

# Routing

```ts
route.get(path, config): Handler
route.head(path, config): Handler
route.post(path, config): Handler
route.put(path, config): Handler
route.patch(path, config): Handler
route.delete(path, config): Handler
route.options(path, config): Handler
route.all(path, config): Handler
route.on(method, path, config): Handler
```

Each route factory returns a **Handler descriptor**:

```ts
{ method, path, handler, guards?, request? }
```

Routes use **URLPattern** for path matching.

If no route matches → framework returns `404`.

---

# RouteConfig

```ts
interface RouteConfig {
  request?: {
    params?: TSchema;
    query?: TSchema;
    body?: TSchema;
  };

  guards?: GuardFn[];

  resolve: HandlerFn;
}
```

---

# Context (`c`)

```ts
interface Context {
  request: Request;
  raw: RawValues;
  input: InputState;
  locals: Record<string, unknown>;
}
```

### Important rules

- Hectoday HTTP does **not** duplicate HTTP primitives Use:

```ts
c.request.headers;
c.request.method;
new URL(c.request.url);
```

No:

- `c.headers`
- `c.method`
- `c.url`

---

# Raw inputs (`c.raw`)

```ts
interface RawValues {
  params: Record<string, string | undefined>;
  query: Record<string, string | string[]>;
  body?: unknown;
}
```

- Extracted by framework
- **Never trusted**
- Always accessible

### Query parsing

```
?tag=a&tag=b&limit=10
→ { tag: ["a","b"], limit: "10" }
```

---

# Body parsing

Hectoday HTTP performs **framework-level body parsing only for JSON**, and
**only when a body schema is declared**.

### When the body is read

- If a route defines `request.body` → Hectoday HTTP reads the request body
  **once** and parses it as JSON.
- If a route does **not** define `request.body` → Hectoday HTTP does **not**
  touch the request body at all.

This keeps body consumption explicit and Fetch-compliant.

---

### How the body is parsed

1. The body is read **once** using `req.text()`
2. If the body is empty (`""`) → it is treated as `undefined`
3. Otherwise, Hectoday HTTP attempts `JSON.parse(text)`

The parsed value is cached on:

```ts
c.raw.body;
```

If Hectoday HTTP parses the body, **do not call** `req.json()` or `req.text()`
again.

---

### Invalid JSON

Invalid JSON is treated as a **validation failure**, not an exception.

- Hectoday HTTP does **not** throw
- Hectoday HTTP does **not** auto-return a response
- `c.input.ok` becomes `false`

A normalized issue is produced:

```ts
{
  part: "body",
  path: [],
  message: "Invalid JSON"
}
```

The handler decides how to respond (e.g. return 400).

---

### Supported formats

At the framework level, Hectoday HTTP supports:

- ✅ JSON

Hectoday HTTP does **not** automatically parse:

- `multipart/form-data`
- `application/x-www-form-urlencoded`
- binary / streams

For these formats, parse the body manually in the handler:

```ts
const form = await c.request.formData();
const buf = await c.request.arrayBuffer();
```

---

### Important implication

Declaring `request.body` means:

> **This endpoint expects a JSON request body.**

Sending a non-JSON body to such a route will always result in
`c.input.ok === false` with an `"Invalid JSON"` issue.

This behavior is intentional and explicit.

---

### Why this design

- No hidden body consumption
- Single-read, deterministic behavior
- Schema-driven parsing
- Full control stays with the handler
- Edge-safe and Fetch-native

---

# Validation (always manual)

Routes may define schemas:

```ts
request: {
  params?: TSchema
  query?: TSchema
  body?: TSchema
}
```

Hectoday HTTP is **schema-library agnostic**. It works with any library that
implements:

```ts
interface SchemaLike<TOut, TErr> {
  safeParse(input: unknown): SafeParseResult<TOut, TErr>;
}

type SafeParseResult<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };
```

Works with:

- Zod
- Valibot
- ArkType
- Any library with `safeParse`

---

## Validation result: `c.input`

```ts
type InputState =
  | {
    ok: true;
    params: TParams;
    query: TQuery;
    body: TBody;
  }
  | {
    ok: false;
    failed: ("params" | "query" | "body")[];
    issues: ValidationIssue[];
    received: {
      params?: unknown;
      query?: unknown;
      body?: unknown;
    };
    errors?: Record<string, unknown>;
  };
```

```ts
interface ValidationIssue {
  part: "params" | "query" | "body";
  path: readonly string[];
  message: string;
  code?: string;
}
```

### Rule: The validated gate

If:

```ts
c.input.ok === false;
```

Then:

- ❌ no validated values exist
- ✅ only `issues`, `failed`, `received`

If:

```ts
c.input.ok === true;
```

Then:

- ✅ all validated values available
- ❌ no `issues` or `failed`

> **Raw values are always accessible via `c.raw`, regardless of validation
> state.**

---

# Validator integration

Hectoday HTTP requires a **validator adapter** to use validation.

```ts
const app = setupHttp({
  validator: myValidator,
  handlers: [...]
});
```

If a route defines `request` schemas but no `validator` is provided, Hectoday
HTTP throws an error (treated as unexpected, goes to `onError` → 500).

### Validator contract

```ts
interface Validator<TSchema> {
  validate<S extends TSchema>(
    schema: S,
    input: unknown,
    part: "params" | "query" | "body",
  ): ValidateResult<InferSchema<S>, InferSchemaError<S>>;
}

type ValidateResult<T, TErr> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[]; error?: TErr };
```

### Zod adapter (copy/paste)

```ts
import type {
  ValidationIssue,
  ValidationPart,
  Validator,
} from "@hectoday/http";
import type { ZodTypeAny } from "zod";

export function createZodValidator(): Validator<ZodTypeAny> {
  return {
    validate(schema, input, part) {
      const result = schema.safeParse(input);

      if (result.success) {
        return { ok: true as const, value: result.data as any };
      }

      const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
        part,
        path: issue.path.map((p) => String(p)),
        message: issue.message,
        code: issue.code,
      }));

      return {
        ok: false as const,
        issues,
        error: result.error as any,
      };
    },
  };
}
```

See [`example/deno/src/main.ts`](https://github.com/hectoday/http/blob/main/example/deno/src/main.ts) for full working example.

### Why this design

- Hectoday HTTP never depends on any schema library
- Type inference comes from `safeParse()` typing
- Runtime stays tiny
- Users control error formatting
- Easy to adapt any validation library

---

# Validation example

```ts
import { z } from "zod";

const app = setupHttp({
  validator: createZodValidator(),
  handlers: [
    route.post("/users", {
      request: {
        body: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      },
      resolve: (c) => {
        // Manual check
        if (!c.input.ok) {
          return Response.json(
            { error: { issues: c.input.issues } },
            { status: 400 },
          );
        }

        // ✨ Types are automatically inferred from schemas!
        // c.input.body is { name: string; email: string }
        const { name, email } = c.input.body;

        return Response.json({ id: crypto.randomUUID(), name, email });
      },
    }),
  ],
});
```

**Type inference is automatic.** No need for type assertions - TypeScript knows
the exact shape of validated data.

**Hectoday HTTP never auto-returns 400.** You decide what validation failures
mean.

---

# Guards

Guards are **pure request gates**.

```ts
type GuardResult =
  | { allow: true; locals?: object }
  | { deny: Response };

type GuardFn = (c: Context) => GuardResult | Promise<GuardResult>;
```

### Behavior

- Guards run **after validation**
- Guards run in order
- First `deny` short-circuits
- Allows may attach locals

### Example: Auth guard

```ts
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");

  if (!token) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = verifyToken(token);
  return { allow: true, locals: { user } };
};
```

---

# Locals (`c.locals`)

- Request-scoped facts
- **Immutable accumulation**
- Provided by:

  - `onRequest`
  - guards

## How immutable accumulation works

Each guard or hook returns a **locals patch**. Hectoday HTTP creates a **new
context** with merged locals at each step.

Nothing mutates. Data only flows forward. Every step is pure.

```ts
// Step 1: onRequest
{
  requestId;
}

// Step 2: guard 1
{
  requestId, user;
}

// Step 3: guard 2
{
  requestId, user, tenant;
}
```

Later patches override earlier values.

Good for:

- user
- tenant
- requestId
- feature flags

Avoid:

- Node buffers
- DB clients
- large payloads

> Locals are **facts**, not services.

---

# group()

Groups compose guards **at build time**.

```ts
group({
  guards: GuardFn[],
  handlers: Handler[]
}): Handler[]
```

Behavior:

```ts
final.guards = [
  ...group.guards,
  ...(route.guards ?? []),
];
```

### Example

```ts
const protectedRoutes = group({
  guards: [requireAuth],
  handlers: [
    route.get("/profile", { resolve: ... }),
    route.post("/logout", { resolve: ... }),
  ],
});
```

---

# onRequest hook

Runs **before routing**, receives the raw Fetch `Request`.

Rules:

- Cannot deny
- Cannot return Response
- May only return locals patch

```ts
onRequest: ((request) => ({
  requestId: crypto.randomUUID(),
  startedAt: Date.now(),
}));
```

Returns a locals patch that will be merged into context **before routing**.

---

# onResponse hook

Runs after handler/guard returns Response.

```ts
onResponse(c, res) {
  const headers = new Headers(res.headers);
  headers.set("x-request-id", String(c.locals.requestId));

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
```

---

# onError hook

Catches **unexpected throws**.

```ts
onError(error, c) {
  console.error(error);
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
```

---

# Error model

| Type       | Handling        |
| ---------- | --------------- |
| Expected   | Return Response |
| Unexpected | Throw → onError |

---

# What Hectoday HTTP decides

- 404 if no route matches
- 500 on uncaught throw
- Validation failures create `c.input.ok === false`

# What YOU decide

- 400 validation errors
- 401 / 403 auth
- 409 conflicts
- 200/201 success
- **All HTTP semantics**

---

# Summary

Hectoday HTTP is:

- explicit
- deterministic
- platform-first
- library-agnostic

> **Hectoday HTTP never decides what HTTP means. It only describes what
> happened. You commit reality.**

---

## License

- Code is licensed under MIT.
- Documentation is licensed under CC BY 4.0 (see apps/docs/LICENSE).
