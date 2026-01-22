---
title: "Reference"
description: "Complete API reference for Hectoday HTTP"
order: 15
---

This is the complete API reference. Use it when you need exact details about types, signatures, and behavior.

For concepts and examples, see the earlier chapters. This is just the facts.

## Core Types

### Context

The context object passed to guards and handlers.

```typescript
interface Context<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown
> {
  request: Request;
  raw: RawValues;
  input: InputState<TParams, TQuery, TBody>;
  locals: Record<string, unknown>;
}
```

**Properties**:

- `request: Request` — The original Web Standard Request object
- `raw: RawValues` — Extracted but unvalidated inputs
- `input: InputState` — Validation results (ok or not ok)
- `locals: Record<string, unknown>` — Request-scoped data from hooks and guards

**Type parameters**:

- `TParams` — Type of validated params (inferred from schema)
- `TQuery` — Type of validated query (inferred from schema)
- `TBody` — Type of validated body (inferred from schema)

### RawValues

Extracted inputs from the request, **not validated**.

```typescript
interface RawValues {
  params: Record<string, string | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}
```

**Properties**:

- `params` — Path parameters from URL pattern (e.g., `:id`)
- `query` — Query parameters from search string
- `body` — Parsed body (only if body schema defined), otherwise undefined

**Notes**:

- All params are `string | undefined`
- Query values can be arrays if parameter appears multiple times
- Body is parsed as JSON when body schema is defined
- Raw values are **not type-safe** — validate them

### InputState

Result of validation. Either all inputs are valid, or some failed.

```typescript
type InputState<TParams, TQuery, TBody> =
  | InputOk<TParams, TQuery, TBody>
  | InputErr;
```

### InputOk

When validation passes:

```typescript
interface InputOk<TParams, TQuery, TBody> {
  ok: true;
  params: TParams;
  query: TQuery;
  body: TBody;
}
```

**Properties**:

- `ok: true` — Validation passed
- `params` — Validated, typed params
- `query` — Validated, typed query
- `body` — Validated, typed body

**Type safety**: TypeScript infers exact types from your schemas.

### InputErr

When validation fails:

```typescript
interface InputErr {
  ok: false;
  failed: ValidationPart[];
  issues: ValidationIssue[];
  received: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
  };
  errors?: Partial<Record<ValidationPart, unknown>>;
}
```

**Properties**:

- `ok: false` — Validation failed
- `failed` — Which parts failed (`["params"]`, `["query", "body"]`, etc.)
- `issues` — Normalized array of all validation issues
- `received` — Raw values that failed validation
- `errors` — Original error objects from validator (optional)

### ValidationIssue

Normalized validation error:

```typescript
interface ValidationIssue {
  part: ValidationPart;
  path: readonly string[];
  message: string;
  code?: string;
}
```

**Properties**:

- `part` — Which part failed: `"params"`, `"query"`, or `"body"`
- `path` — Path to the failing field (e.g., `["email"]` or `["user", "name"]`)
- `message` — Human-readable error message
- `code` — Optional error code from validator

### ValidationPart

```typescript
type ValidationPart = "params" | "query" | "body";
```

Which part of the request is being validated.

### Handler

A route descriptor returned by `route.*()` functions:

```typescript
interface Handler {
  method: string | string[];
  path: string;
  handler: HandlerFn;
  guards?: GuardFn[];
  request?: RequestSchemas<SchemaLike>;
}
```

**Properties**:

- `method` — HTTP method(s): `"GET"`, `"POST"`, or `["GET", "POST"]`
- `path` — URL pattern with optional parameters: `"/users/:id"`
- `handler` — The function that returns a Response
- `guards` — Optional guards that run before handler
- `request` — Optional validation schemas

**Notes**:

- Created by `route.get()`, `route.post()`, etc.
- You rarely construct this manually
- Passed to `setup()` in the `handlers` array

### HandlerFn

The function that handles the request:

```typescript
type HandlerFn<TParams = unknown, TQuery = unknown, TBody = unknown> = (
  c: Context<TParams, TQuery, TBody>
) => Response | Promise<Response>;
```

**Parameters**:

- `c: Context` — The request context

**Returns**:

- `Response | Promise<Response>` — Must return a Web Standard Response

**Notes**:

- Must always return a Response
- Can be async
- Type parameters inferred from schemas

### RouteParams

Type helper to extract param types from a path pattern:

```typescript
type RouteParams<T extends string> = /* implementation */
```

**Usage**:

```typescript
type Params = RouteParams<"/users/:id">; // { id: string }
type Params2 = RouteParams<"/orgs/:orgId/repos/:repoId">; 
// { orgId: string; repoId: string }
```

**Notes**:

- Automatically inferred by TypeScript
- Used internally for type safety
- You rarely use this explicitly

## Route Functions

### route.get()

```typescript
function get<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create a GET route.

**Parameters**:

- `path` — URL pattern (e.g., `"/users/:id"`)
- `config` — Route configuration

**Returns**: Handler descriptor

**Example**:

```typescript
route.get("/users/:id", {
  resolve: (c) => Response.json({ id: c.raw.params.id })
})
```

### route.post()

```typescript
function post<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create a POST route.

### route.put()

```typescript
function put<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create a PUT route.

### route.patch()

```typescript
function patch<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create a PATCH route.

### route.delete()

```typescript
function delete<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create a DELETE route.

### route.head()

```typescript
function head<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create a HEAD route.

### route.options()

```typescript
function options<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create an OPTIONS route.

### route.all()

```typescript
function all<TPath extends string>(
  path: TPath,
  config: RouteConfig
): Handler
```

Create a route that matches **all** HTTP methods.

### route.on()

```typescript
function on<TPath extends string>(
  method: string,
  path: TPath,
  config: RouteConfig
): Handler
```

Create a route for a custom HTTP method.

**Parameters**:

- `method` — Any HTTP method string (e.g., `"PROPFIND"`)
- `path` — URL pattern
- `config` — Route configuration

**Example**:

```typescript
route.on("PROPFIND", "/webdav", {
  resolve: () => new Response("WebDAV response")
})
```

### RouteConfig

```typescript
interface RouteConfig<
  TParamsSchema = unknown,
  TQuerySchema = unknown,
  TBodySchema = unknown
> {
  request?: RequestSchemas<TParamsSchema, TQuerySchema, TBodySchema>;
  guards?: GuardFn[];
  resolve: HandlerFn;
}
```

**Properties**:

- `request` — Optional validation schemas
- `guards` — Optional guards
- `resolve` — Handler function (required)

### RequestSchemas

```typescript
interface RequestSchemas<
  TParamsSchema = unknown,
  TQuerySchema = unknown,
  TBodySchema = unknown
> {
  params?: TParamsSchema;
  query?: TQuerySchema;
  body?: TBodySchema;
}
```

**Properties**:

- `params` — Schema for path parameters
- `query` — Schema for query string
- `body` — Schema for request body

**Example**:

```typescript
request: {
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ include: z.string().optional() }),
  body: z.object({ name: z.string() })
}
```

## Setup and Configuration

### setup()

```typescript
function setup(config: Config | Handler[]): {
  fetch: (req: Request) => Promise<Response>;
}
```

Bootstrap the Hectoday HTTP application.

**Parameters**:

- `config: Config | Handler[]` — Configuration object or array of handlers

**Returns**: Object with `fetch` method

**Example**:

```typescript
const app = setup({
  handlers: [...],
  validator: zodValidator,
  onRequest: (req) => ({ requestId: crypto.randomUUID() }),
  onResponse: (c, res) => res,
  onError: (err, c) => Response.json({ error: "Internal error" }, { status: 500 })
});
```

### Config

```typescript
interface Config {
  handlers: Handler[];
  validator?: Validator<SchemaLike>;
  onRequest?: OnRequestHandler;
  onResponse?: OnResponseHandler;
  onError?: OnErrorHandler;
}
```

**Properties**:

- `handlers` — Array of route handlers (required)
- `validator` — Validator adapter (required if any route uses schemas)
- `onRequest` — Hook that runs before routing
- `onResponse` — Hook that runs after handler
- `onError` — Hook that handles unexpected errors

### OnRequestHandler

```typescript
type OnRequestHandler = (
  request: Request
) => void | Record<string, unknown> | Promise<void | Record<string, unknown>>;
```

Runs **before routing**, receives the raw Request.

**Parameters**:

- `request: Request` — The incoming request

**Returns**:

- `void` — No locals to add
- `Record<string, unknown>` — Locals to merge into context
- `Promise` — Async version of above

**Notes**:

- Cannot deny requests
- Cannot return Response
- Only adds to `c.locals`

**Example**:

```typescript
onRequest: (request) => {
  return {
    requestId: crypto.randomUUID(),
    startTime: Date.now()
  };
}
```

### OnResponseHandler

```typescript
type OnResponseHandler = (
  c: Context,
  response: Response
) => Response | Promise<Response>;
```

Runs **after handler**, can modify the response.

**Parameters**:

- `c: Context` — The request context
- `response: Response` — The response from handler

**Returns**:

- `Response` — Modified or original response

**Example**:

```typescript
onResponse: (c, response) => {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", String(c.locals.requestId));
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

### OnErrorHandler

```typescript
type OnErrorHandler = (
  error: unknown,
  c: Context
) => Response | Promise<Response>;
```

Handles **unexpected errors** that escape handlers.

**Parameters**:

- `error: unknown` — The thrown error
- `c: Context` — Minimal context (might not have full data)

**Returns**:

- `Response` — Error response to send to client

**Notes**:

- Only catches **unexpected** errors (bugs, crashes)
- Expected errors should be returned explicitly in handlers
- Don't expose error details to clients in production

**Example**:

```typescript
onError: (error, c) => {
  console.error("Unexpected error:", {
    error,
    requestId: c.locals.requestId,
    path: c.request.url
  });
  
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

## Guard API

### GuardFn

```typescript
type GuardFn = (c: Context) => GuardResult | Promise<GuardResult>;
```

A function that makes an allow/deny decision.

**Parameters**:

- `c: Context` — Request context

**Returns**:

- `GuardResult` — Allow or deny

**Notes**:

- Can be async
- Must return `GuardResult`
- Never throws (to deny, return `{ deny: Response }`)

### GuardResult

```typescript
type GuardResult =
  | { allow: true; locals?: Record<string, unknown> }
  | { deny: Response };
```

The result of a guard.

### Allow Result

```typescript
{ allow: true; locals?: Record<string, unknown> }
```

**Properties**:

- `allow: true` — Request continues
- `locals` — Optional data to add to `c.locals`

**Example**:

```typescript
return { allow: true, locals: { userId: "123" } };
```

### Deny Result

```typescript
{ deny: Response }
```

**Properties**:

- `deny: Response` — The response to send (request ends)

**Example**:

```typescript
return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
```

### Guard Example

```typescript
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return {
      deny: Response.json({ error: "Unauthorized" }, { status: 401 })
    };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    return {
      deny: Response.json({ error: "Invalid token" }, { status: 401 })
    };
  }
  
  return { allow: true, locals: { user, userId: user.id } };
};
```

## Group API

### group()

```typescript
function group(options: GroupOptions): Handler[]
```

Apply guards to multiple handlers.

**Parameters**:

- `options: GroupOptions` — Group configuration

**Returns**: Array of handlers with guards prepended

**Example**:

```typescript
const adminRoutes = group({
  guards: [requireAuth, requireAdmin],
  handlers: [
    route.get("/admin/users", { resolve: ... }),
    route.delete("/admin/users/:id", { resolve: ... })
  ]
});
```

### GroupOptions

```typescript
interface GroupOptions {
  guards: GuardFn[];
  handlers: (Handler | Handler[])[];
}
```

**Properties**:

- `guards` — Guards to apply to all handlers
- `handlers` — Handlers (or nested groups) to apply guards to

**Notes**:

- Guards are **prepended** to each handler's guards
- Nested groups accumulate guards
- Operates at **build time** (no runtime overhead)

## Validator API

### Validator

```typescript
interface Validator<TSchema extends SchemaLike> {
  validate<S extends TSchema>(
    schema: S,
    input: unknown,
    part: ValidationPart
  ): ValidateResult<InferSchema<S>, InferSchemaError<S>>;
}
```

Adapter interface for validation libraries.

**Type parameters**:

- `TSchema` — The schema type from your validation library

**Methods**:

- `validate()` — Validate input against schema

### validate()

```typescript
validate<S extends TSchema>(
  schema: S,
  input: unknown,
  part: ValidationPart
): ValidateResult<InferSchema<S>, InferSchemaError<S>>
```

**Parameters**:

- `schema` — The schema to validate against
- `input` — The data to validate (unknown type)
- `part` — Which part is being validated (`"params"`, `"query"`, `"body"`)

**Returns**: `ValidateResult` (success or failure)

### ValidateResult

```typescript
type ValidateResult<T, TErr> =
  | ValidateOk<T>
  | ValidateErr<TErr>;
```

### ValidateOk

```typescript
interface ValidateOk<T> {
  ok: true;
  value: T;
}
```

**Properties**:

- `ok: true` — Validation succeeded
- `value: T` — The validated, typed value

### ValidateErr

```typescript
interface ValidateErr<TErr> {
  ok: false;
  issues: ValidationIssue[];
  error?: TErr;
}
```

**Properties**:

- `ok: false` — Validation failed
- `issues` — Normalized array of issues
- `error` — Optional original error from validator

### SchemaLike

```typescript
interface SchemaLike<TOut = unknown, TErr = unknown> {
  safeParse(input: unknown): SafeParseResult<TOut, TErr>;
}
```

Minimal interface that validation schemas must implement.

**Methods**:

- `safeParse()` — Parse input, return success or failure

### SafeParseResult

```typescript
type SafeParseResult<T, E> =
  | SafeParseSuccess<T>
  | SafeParseFailure<E>;
```

### SafeParseSuccess

```typescript
interface SafeParseSuccess<T> {
  success: true;
  data: T;
}
```

### SafeParseFailure

```typescript
interface SafeParseFailure<E> {
  success: false;
  error: E;
}
```

### Validator Example (Zod)

```typescript
import { z } from "zod";
import type { Validator, ValidationIssue } from "@hectoday/http";

export const zodValidator: Validator<z.ZodType> = {
  validate(schema, input, part) {
    const result = schema.safeParse(input);
    
    if (result.success) {
      return { ok: true, value: result.data };
    }
    
    const issues: ValidationIssue[] = result.error.issues.map(issue => ({
      part,
      path: issue.path.map(String),
      message: issue.message,
      code: issue.code
    }));
    
    return {
      ok: false,
      issues,
      error: result.error
    };
  }
};
```

## Type Inference

### InferSchema

```typescript
type InferSchema<T> = T extends SchemaLike<infer TOut, any> ? TOut : never;
```

Extract the output type from a schema.

**Example**:

```typescript
const schema = z.object({ name: z.string() });
type Output = InferSchema<typeof schema>; // { name: string }
```

### InferSchemaError

```typescript
type InferSchemaError<T> = T extends SchemaLike<any, infer TErr> ? TErr : never;
```

Extract the error type from a schema.

### InferInput

```typescript
type InferInput<T> = T extends SchemaLike<infer TOut, any>
  ? TOut
  : T extends { safeParse: any }
  ? any
  : never;
```

Infer input type from schema (for type-safe handlers).

## Helper Utilities

Common helpers available in `@hectoday/http-helpers` (separate package).

### maxBodyBytes()

Limit request body size.

```typescript
function maxBodyBytes(limit: number): GuardFn
```

**Parameters**:

- `limit: number` — Maximum bytes allowed

**Returns**: Guard function

**Example**:

```typescript
import { maxBodyBytes, SIZES } from "@hectoday/http-helpers";

route.post("/upload", {
  guards: [maxBodyBytes(10 * SIZES.MB)],
  resolve: async (c) => {
    const data = await c.request.arrayBuffer();
    return Response.json({ size: data.byteLength });
  }
})
```

### SIZES

Size constants:

```typescript
const SIZES = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024
};
```

### zodValidator

Pre-built Zod validator adapter.

```typescript
import { zodValidator } from "@hectoday/http-helpers";

const app = setup({
  validator: zodValidator,
  handlers: [...]
});
```

### corsHeaders()

Generate CORS headers.

```typescript
function corsHeaders(options: CorsOptions): Headers
```

**Parameters**:

```typescript
interface CorsOptions {
  origin: string | string[] | "*";
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}
```

**Returns**: Headers object with CORS headers

**Example**:

```typescript
import { corsHeaders } from "@hectoday/http-helpers";

const app = setup({
  handlers: [...],
  onResponse: (c, response) => {
    const cors = corsHeaders({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"]
    });
    
    const headers = new Headers(response.headers);
    for (const [key, value] of cors.entries()) {
      headers.set(key, value);
    }
    
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
});
```

## Constants

### HTTP Status Codes

No built-in constants, use numbers directly:

```typescript
return Response.json({ error: "Not found" }, { status: 404 });
```

Common status codes:

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### HTTP Methods

No built-in constants, use strings:

```typescript
route.on("PROPFIND", "/webdav", { resolve: ... })
```

## Error Handling

### Framework Errors

Hectoday HTTP throws errors for:

**No validator provided when schemas exist**:

```typescript
// Throws: "Validator is required when route defines request schemas"
const app = setup({
  handlers: [
    route.post("/users", {
      request: { body: schema }, // Schema defined
      resolve: (c) => ...
    })
  ]
  // Missing validator!
});
```

**Solution**: Provide a validator:

```typescript
const app = setup({
  validator: zodValidator, // ✓ Now provided
  handlers: [...]
});
```

### 404 Handling

**Framework returns 404** when no route matches:

```typescript
// No route for /unknown
const app = setup({ handlers: [...] });

const response = await app.fetch(new Request("http://localhost/unknown"));
// response.status === 404
// response.body === "Not Found"
```

**Custom 404**: Add a catch-all route:

```typescript
route.all("/*", {
  resolve: () => Response.json({ error: "Not found" }, { status: 404 })
})
```

## Version Compatibility

**Minimum runtime requirements**:

- Deno 1.30+
- Bun 1.0+
- Node.js 18+ (with fetch support)
- Cloudflare Workers (any version with Request/Response)

**Web Standard APIs required**:

- `Request`
- `Response`
- `Headers`
- `URLPattern` (for route matching)
- `crypto.randomUUID()` (for request IDs in helpers)

---

Next: [Philosophy (Revisited)](./philosophy-revisited) — Why Hectoday HTTP makes these design choices.
