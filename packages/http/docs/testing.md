# Testing

Test the app, not the framework. Import the app, make requests, assert on responses.

```ts
import { describe, it, expect } from "vitest";
import { app } from "./app";

describe("POST /users", () => {
  it("creates a user", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "Alice", email: "a@b.com" },
      headers: { authorization: "Bearer valid-token" },
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe("Alice");
    expect(body.id).toBeDefined();
  });

  it("rejects invalid body", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "", email: "bad" },
      headers: { authorization: "Bearer valid-token" },
    });

    expect(res.status).toBe(400);
  });

  it("rejects missing auth", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "Alice", email: "a@b.com" },
    });

    expect(res.status).toBe(401);
  });
});
```

## `app.request`

Convenience method on the app. Builds a `Request`, serializes body as JSON, sets headers, calls `app.fetch`. Returns a standard `Response`.

```ts
// GET — just a path
const res = await app.request("/health");

// POST — with body and headers
const res = await app.request("/users", {
  method: "POST",
  body: { name: "Alice", email: "a@b.com" },
  headers: { authorization: "Bearer token" },
});

// GET — with query parameters
const res = await app.request("/users", {
  query: { page: "2", limit: "10" },
});
```

The full request lifecycle runs — `onRequest`, routing, validation, `resolve`, `onResponse`. Tests hit the exact same code as production requests. No mocking the framework.

## `app.fetch`

For cases where `app.request` doesn't fit (custom content types, raw body, specific request construction), use `app.fetch` directly:

```ts
const res = await app.fetch(
  new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "content-type": "text/xml" },
    body: "<event>something</event>",
  }),
);
```

## Test runner

Bring your own. Vitest, Jest, Deno.test — anything that can call async functions and assert on values works. The framework has no opinion on test runners.

## What you're testing

When you call `app.request`, the entire framework runs:

1. `onRequest` hook
2. Route matching
3. Input extraction and validation
4. Your handler (`resolve`)
5. `onResponse` hook

This is an integration test of your app. You're testing your routes, your auth functions, your business logic, and your hooks — all together, as they run in production.

For unit testing individual auth functions or business logic, test them directly — they're just functions:

```ts
import { authenticate } from "./auth";

it("rejects missing header", () => {
  const result = authenticate(new Request("http://localhost"));
  expect(result).toBeInstanceOf(Response);
});

it("returns user for valid token", () => {
  const result = authenticate(
    new Request("http://localhost", {
      headers: { authorization: "Bearer valid-token" },
    }),
  );
  expect(result).not.toBeInstanceOf(Response);
  expect((result as User).id).toBeDefined();
});
```

No framework involved. Just function in, value out.
