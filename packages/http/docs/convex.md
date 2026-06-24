# Convex

Run a Hectoday app inside [Convex](https://convex.dev) HTTP actions. This is the
Hectoday equivalent of
[using Hono with Convex](https://stack.convex.dev/hono-with-convex): you get
dynamic routing, Zod validation, lifecycle hooks, and CORS on top of Convex's
HTTP endpoints, and your handlers can read and write the database through
`c.env`.

```bash
npm install @hectoday/convex
```

`@hectoday/convex` has `@hectoday/http` and `convex` as peer dependencies.

## The `c.env` binding

A Hectoday `app.fetch(request, env)` takes an optional second argument that
handlers receive as `c.env`. The Convex adapter passes the Convex
[`ActionCtx`](https://docs.convex.dev/functions/actions) through as that binding,
so `c.env` is how you call queries, mutations, and actions — the same role
`c.env` plays in `HonoWithConvex`.

Use `convexRoutes<ActionCtx>()` (or the core `createRoutes<ActionCtx>()`) to get
a route builder whose `c.env` is typed as your generated `ActionCtx`.

## Wiring it up

Define your routes, build an `app` with `setup`, and export a router from
`convex/http.ts`:

```ts
// convex/routes.ts
import { convexRoutes } from "@hectoday/convex";
import { z } from "zod/v4";
import type { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";

const route = convexRoutes<ActionCtx>();

export const routes = [
  route.get("/listMessages/:userId", {
    request: { params: z.object({ userId: z.string().regex(/^[0-9]+$/) }) },
    resolve: async (c) => {
      if (!c.input.ok) return Response.json(c.input.issues, { status: 400 });
      const messages = await c.env.runQuery(api.messages.getByAuthor, {
        authorNumber: c.input.params.userId,
      });
      return Response.json(messages);
    },
  }),

  route.post("/postMessage", {
    request: { body: z.object({ body: z.string(), author: z.string() }) },
    resolve: async (c) => {
      if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
      await c.env.runMutation(api.messages.send, c.input.body);
      return new Response("Sent message!");
    },
  }),
];
```

```ts
// convex/http.ts
import { setup } from "@hectoday/http";
import { convexRouter } from "@hectoday/convex";
import { routes } from "./routes";

const app = setup({ routes });

export default convexRouter(app);
```

That's it. Every request to your Convex HTTP endpoint
(`https://<deployment>.convex.site/...`) is routed, validated, and handled by
Hectoday, with the `ActionCtx` available as `c.env`.

## Hooks and CORS

Lifecycle hooks also receive `env`, so middleware can talk to Convex too — for
example reading the authenticated identity:

```ts
const app = setup({
  onRequest: async ({ env }) => {
    const identity = await env.auth.getUserIdentity();
    return { identity };
  },
  routes,
});
```

CORS works exactly as it does elsewhere — see [CORS](./cors.md). Add the
`preflight` route and apply `headers` in `onResponse`.

## How it works

`convexRouter(app)` registers a single catch-all `pathPrefix: "/"` route per
HTTP method on a Convex `httpRouter`, each backed by an `httpAction` that calls
`app.fetch(request, ctx)`. All routing decisions are made by Hectoday.

By default it registers `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, and `PATCH`
(every method Convex can route). Pass `{ methods: [...] }` to narrow that set.
`HEAD` probes are served by the matching `GET` route — Hectoday runs the handler
and strips the body — so health checks work without extra configuration.

```ts
export default convexRouter(app, { methods: ["GET", "POST"] });
```

> **Dashboard note:** because everything is served through prefix routes, the
> Convex dashboard lists one catch-all entry per method rather than each
> individual Hectoday route.

## Testing

For full-stack tests through the real Convex router (and a simulated database),
use [`convex-test`](https://docs.convex.dev/testing/convex-test). Its
`t.fetch(path, init)` routes through your `convex/http.ts` default export, and
`t.withIdentity(...)` exercises authenticated routes:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("sends a message", async () => {
  const t = convexTest(schema, modules);
  const res = await t.fetch("/postMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ author: "ada", body: "hi" }),
  });
  expect(res.status).toBe(200);
});
```

For a quick unit test of a single handler, you can also call `app.fetch`
directly with a mock context:

```ts
import { expect, test, vi } from "vitest";
import { app } from "./app";

test("listMessages calls the query", async () => {
  const runQuery = vi.fn(() => [{ body: "hi" }]);
  const ctx = { runQuery } as unknown as ActionCtx;

  const res = await app.fetch(new Request("http://x/listMessages/7"), ctx);

  expect(await res.json()).toEqual([{ body: "hi" }]);
  expect(runQuery).toHaveBeenCalled();
});
```
