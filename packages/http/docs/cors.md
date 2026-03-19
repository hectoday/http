# CORS

The `cors()` helper returns two pieces: a preflight route and a response header function.

```ts
import { setup, route, cors } from "@hectoday/http";

const { preflight, headers } = cors({
  origin: "https://myapp.com",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});

const app = setup({
  routes: [preflight(route), ...userRoutes],

  onResponse: ({ request, response }) => headers(request, response),
});
```

`preflight(route)` registers a catch-all `OPTIONS /**` route. When a browser sends a preflight request, this route responds with `204` and the configured CORS headers.

`headers(request, response)` adds CORS headers to any response. Used in `onResponse` so every response — success, error, 404 — gets the right headers.

## Why two pieces

CORS has two parts: preflight handling (OPTIONS requests) and response headers (every request). The helper makes both visible. You wire them explicitly — `preflight` in routes, `headers` in `onResponse`.

## Configuration

```ts
cors({
  origin: "https://myapp.com", // required — string or string[]
  methods: ["GET", "POST"], // defaults to GET, HEAD, PUT, PATCH, POST, DELETE
  allowHeaders: ["Content-Type"], // request headers the client can send
  exposeHeaders: ["X-Request-Id"], // response headers the browser can read
  credentials: true, // allow cookies/auth headers
  maxAge: 86400, // preflight cache duration in seconds
});
```

Multiple origins:

```ts
cors({
  origin: ["https://myapp.com", "https://staging.myapp.com"],
});
```

Allow all origins:

```ts
cors({
  origin: "*",
});
```

## Origin matching

The `headers` function checks the request's `Origin` header against your allowed origins. If the origin matches, the `Access-Control-Allow-Origin` header is set to that specific origin (not `*`), and a `Vary: Origin` header is added. If it doesn't match, no CORS headers are added — the browser blocks the request.

## Without the helper

You can handle CORS manually. It's just headers:

```ts
route.options("/**", {
  resolve: (c) =>
    new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "https://myapp.com",
        "access-control-allow-methods": "GET, POST, PUT, DELETE",
        "access-control-allow-headers": "Content-Type, Authorization",
        "access-control-max-age": "86400",
      },
    }),
});
```

Plus the same headers in `onResponse`. The `cors()` helper just saves you from writing it twice.
