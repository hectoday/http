# API Reference

## `setup(config)`

Creates the app.

```ts
import { setup } from "@hectoday/http";

const app = setup({
  routes: RouteDescriptor[],
  onRequest?: ({ request: Request }) => TLocals | void,
  onResponse?: ({ request: Request, response: Response, locals: TLocals }) => Response,
  onError?: ({ error: unknown, request: Request, locals: Partial<TLocals> }) => Response,
  onNotFound?: ({ request: Request, locals: TLocals }) => Response,
});
```

Returns:

```ts
interface App {
  fetch: (request: Request) => Response | Promise<Response>;
  request: (path: string, options?: RequestOptions) => Promise<Response>;
  routes: RouteDescriptor[];
}
```

### `app.fetch`

The server handler. Takes a web standard `Request`, returns a `Response`. Pass it to your runtime's serve function.

### `app.request`

Test convenience. Builds a `Request` and calls `app.fetch`.

```ts
interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}
```

Defaults: method is `"GET"`, body is JSON-serialized with `content-type: application/json`.

### `app.routes`

The array of route descriptors passed to setup. Includes `request` and `response` schemas for OpenAPI generation.

---

## `route`

Defines routes. Each method returns a `RouteDescriptor`.

```ts
import { route } from "@hectoday/http";

route.get(path, config);
route.post(path, config);
route.put(path, config);
route.patch(path, config);
route.delete(path, config);
route.head(path, config);
route.options(path, config);
route.all(path, config); // matches any method
```

### Route config

```ts
{
  request?: {
    params?: z.ZodType,
    query?: z.ZodType,
    body?: z.ZodType,
  },
  response?: Record<number, z.ZodType>,
  resolve: (c: Context) => Response | Promise<Response>,
}
```

### Path patterns

- `/users` — exact match
- `/users/:id` — named parameter
- `/files/**` — wildcard (matches any depth)
- `/files/**:path` — named wildcard

---

## `group(routes)`

Organizes routes. Takes an array, returns an array.

```ts
import { group } from "@hectoday/http";

const userRoutes = group([
  route.get("/users", { ... }),
  route.post("/users", { ... }),
]);
```

Spread into setup:

```ts
setup({ routes: [...userRoutes] });
```

---

## `cors(options)`

Returns a preflight route and a headers function.

```ts
import { cors } from "@hectoday/http";

const { preflight, headers } = cors({
  origin: string | string[],
  methods?: string[],
  allowHeaders?: string[],
  exposeHeaders?: string[],
  credentials?: boolean,
  maxAge?: number,
});
```

### `preflight(route)`

Returns a `RouteDescriptor` for `OPTIONS /**`. Add it to your routes array.

### `headers(request, response)`

Returns a new `Response` with CORS headers added. Use in `onResponse`.

---

## Context

Passed to every `resolve` function.

```ts
interface Context {
  readonly request: Request;
  readonly input: InputState;
  readonly locals: Record<string, unknown>;
}
```

### `c.request`

The original web standard `Request`. Unmodified.

### `c.input`

Discriminated union. Check `c.input.ok` first.

```ts
// When ok
c.input.ok; // true
c.input.params; // typed from Zod schema
c.input.query; // typed from Zod schema
c.input.body; // typed from Zod schema
c.input.issues; // []
c.input.failed; // []

// When not ok
c.input.ok; // false
c.input.params; // undefined
c.input.query; // undefined
c.input.body; // undefined
c.input.issues; // ValidationIssue[]
c.input.failed; // ("params" | "query" | "body")[]
```

### `c.locals`

Per-request data from `onRequest`. Type is `Record<string, unknown>` in handlers. Typed from `onRequest` return in hooks.

---

## `ValidationIssue`

```ts
interface ValidationIssue {
  part: "params" | "query" | "body";
  path: readonly string[];
  message: string;
  code?: string;
}
```

---

## `RouteDescriptor`

```ts
interface RouteDescriptor {
  method: string;
  path: string;
  config: {
    request?: {
      params?: z.ZodType;
      query?: z.ZodType;
      body?: z.ZodType;
    };
    response?: Record<number, z.ZodType>;
    resolve: (c: Context) => Response | Promise<Response>;
  };
}
```
