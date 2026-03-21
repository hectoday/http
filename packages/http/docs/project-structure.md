# Project structure

Separate the app from the server.

```
src/
  app.ts          # setup() — routes, hooks
  server.ts       # one line — runs the app
  auth.ts         # authenticate, requireAdmin
  users.ts        # user routes
  admin.ts        # admin routes
  users.test.ts   # tests
```

## `app.ts`

Creates the app. Imports route groups, configures hooks.

```ts
import { setup, route } from "@hectoday/http";
import { userRoutes } from "./users";
import { adminRoutes } from "./admin";

export const app = setup({
  onRequest: ({ request }) => ({
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
  }),

  routes: [
    route.get("/health", {
      resolve: () => Response.json({ status: "ok" }),
    }),
    ...userRoutes,
    ...adminRoutes,
  ],

  onResponse: ({ response, locals }) => {
    const headers = new Headers(response.headers);
    headers.set("x-request-id", locals.requestId);
    return new Response(response.body, { status: response.status, headers });
  },

  onError: ({ error, locals }) => {
    console.error({ error, requestId: locals.requestId });
    return Response.json({ error: "Internal error" }, { status: 500 });
  },
});
```

## `server.ts`

Runs the app. One line.

```ts
import { app } from "./app";

Deno.serve(app.fetch);
```

Tests never import this file.

## Route files

Each file exports a group:

```ts
// users.ts
import * as z from "zod/v4";
import { route, group } from "@hectoday/http";
import { authenticate } from "./auth";

const CreateUser = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const userRoutes = group([
  route.get("/users", {
    resolve: async (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      const users = await db.users.list();
      return Response.json({ users });
    },
  }),

  route.post("/users", {
    request: { body: CreateUser },
    resolve: async (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const user = await db.users.create(c.input.body);
      return Response.json(user, { status: 201 });
    },
  }),
]);
```

## Auth file

```ts
// auth.ts
import type { User } from "./types";

export function authenticate(request: Request): User | Response {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = verifyToken(header.slice(7));
  if (!user) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  return user;
}

export function requireAdmin(user: User): true | Response {
  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return true;
}
```

## Why this structure

The app is separate from the server so tests can import it without starting a listener. Route files export groups that spread into the routes array. Auth is a plain module with plain functions.

No magic file-based routing. No auto-discovery. You import what you use, you spread what you need. The `app.ts` file is the single source of truth for what routes exist and what hooks run.
