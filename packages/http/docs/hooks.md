# Hooks

Four hooks. Four jobs. No middleware.

```ts
const app = setup({
  onRequest: ...,    // before routing
  routes: [...],
  onResponse: ...,   // after every response
  onError: ...,      // when a handler throws
  onNotFound: ...,   // when no route matches
});
```

## `onRequest`

Runs before routing. Every request hits this hook.

Use it to produce per-request data (request ID, start time) or for side effects (logging):

```ts
// With locals — the return value becomes c.locals in hooks
onRequest: ({ request }) => ({
  requestId: crypto.randomUUID(),
  startTime: Date.now(),
});
```

```ts
// Side-effect only — no return needed
onRequest: ({ request }) => {
  console.log(`→ ${request.method} ${new URL(request.url).pathname}`);
};
```

When `onRequest` returns an object, that object is available as `locals` in `onResponse`, `onError`, and `onNotFound`. TypeScript infers the type automatically — if you return `{ requestId: string, startTime: number }`, that's what `locals` is in every hook.

If `onRequest` throws, the error goes to `onError`.

## `onResponse`

Runs after every response — handler success, 404, error. Use it to modify responses:

```ts
onResponse: ({ request, response, locals }) => {
  const duration = Date.now() - locals.startTime;
  const headers = new Headers(response.headers);
  headers.set("x-request-id", locals.requestId);
  headers.set("x-response-time", `${duration}ms`);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
};
```

`onResponse` receives:

- `request` — the original Request
- `response` — the Response from the handler, onNotFound, or onError
- `locals` — the object from onRequest (typed)

It must return a Response. Return the original to pass through, or construct a new one to modify.

If `onResponse` throws, the original response is sent as-is.

## `onError`

Runs when a handler throws an unexpected error. Returns an error response:

```ts
onError: ({ error, request, locals }) => {
  console.error({
    error,
    requestId: locals.requestId,
    path: new URL(request.url).pathname,
  });
  return Response.json({ error: "Internal error" }, { status: 500 });
};
```

`locals` is `Partial<TLocals>` because `onRequest` itself might have been the thing that threw — in that case, locals is incomplete.

If `onError` is not defined, the framework returns a bare `{"error":"Internal Server Error"}` with status 500.

`onError` is for unexpected errors — things the handler didn't catch. For expected failures (user not found, invalid data), return explicitly from the handler:

```ts
// Don't throw for expected cases
if (!user) {
  return Response.json({ error: "Not found" }, { status: 404 });
}
```

## `onNotFound`

Runs when no route matches the request method and path:

```ts
onNotFound: ({ request, locals }) => {
  return Response.json(
    {
      error: "Not found",
      path: new URL(request.url).pathname,
    },
    { status: 404 },
  );
};
```

If `onNotFound` is not defined, the framework returns `{"error":"Not Found"}` with status 404.

The response from `onNotFound` flows through `onResponse` — so your headers, logging, and CORS apply to 404s too.

## Lifecycle

Every request follows this path:

```
1. Request arrives
2. onRequest → produces locals
3. Route matching
   → No match: onNotFound → onResponse → send
4. Extract and validate inputs
5. resolve (handler)
   → Throws: onError → onResponse → send
7. onResponse → send
```

`onResponse` always runs. Whether the handler succeeded, a 404 was returned, or an error was caught — the response passes through `onResponse` before being sent.

## Typed locals

The return type of `onRequest` flows into the hook signatures:

```ts
const app = setup({
  onRequest: ({ request }) => ({
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
  }),

  routes: [...],

  // locals is { requestId: string; startTime: number }
  onResponse: ({ response, locals }) => {
    locals.requestId  // string ✓
    locals.startTime  // number ✓
    return response;
  },

  // locals is Partial<{ requestId: string; startTime: number }>
  onError: ({ error, locals }) => {
    locals.requestId  // string | undefined ✓
    return Response.json({ error: "Internal error" }, { status: 500 });
  },
});
```

No annotations. TypeScript infers everything from `onRequest`.
