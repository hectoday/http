# Your first server

```ts
import { setup, route } from "@hectoday/http";

const app = setup({
  routes: [
    route.get("/hello", {
      resolve: () => new Response("Hello World"),
    }),
  ],
});

Deno.serve(app.fetch);
```

Three things happened:

`route.get("/hello", { ... })` defined a route. It matches GET requests to `/hello`. The `resolve` function is the handler — it receives a context and returns a Response.

`setup({ routes: [...] })` created the app. It takes your routes, builds a router, and returns an object with a `fetch` method.

`Deno.serve(app.fetch)` started the server. `app.fetch` is a function that takes a `Request` and returns a `Response`. That's the web standard server signature — it works with any runtime.

## The context

Every handler receives a context object:

```ts
route.get("/users/:id", {
  resolve: (c) => {
    c.request; // the web standard Request
    c.input; // validation results
    c.locals; // per-request data from onRequest hook

    return Response.json({ id: c.input.params.id });
  },
});
```

`c.request` is the original `Request`. Use it for headers, method, URL — anything the Fetch API provides.

`c.input` contains extracted and validated data. More on this in [Validation](./validation.md).

`c.locals` contains per-request data from the `onRequest` hook. More on this in [Hooks](./hooks.md).

## Returning a Response

Every handler must return a `Response`. Not a string. Not an object. A `Response`.

```ts
// Plain text
resolve: () => new Response("Hello World");

// JSON
resolve: () => Response.json({ message: "Hello" });

// JSON with status
resolve: () => Response.json({ id: 1 }, { status: 201 });

// Headers
resolve: () =>
  new Response("OK", {
    headers: { "x-custom": "value" },
  });

// Empty (204 No Content)
resolve: () => new Response(null, { status: 204 });

// Streaming
resolve: () =>
  new Response(readableStream, {
    headers: { "content-type": "text/event-stream" },
  });
```

These are all standard `Response` constructors. No framework wrappers.

## Multiple routes

```ts
const app = setup({
  routes: [
    route.get("/health", {
      resolve: () => Response.json({ status: "ok" }),
    }),

    route.get("/users/:id", {
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }
        return Response.json({ id: c.input.params.id });
      },
    }),

    route.post("/users", {
      resolve: async (c) => {
        return Response.json({ created: true }, { status: 201 });
      },
    }),
  ],
});
```

Routes are an array. Order doesn't matter — the router matches by method and path pattern, not by position.

## What happens when nothing matches

If no route matches, the framework returns `{"error":"Not Found"}` with status 404. You can customize this with the `onNotFound` hook — see [Hooks](./hooks.md).
