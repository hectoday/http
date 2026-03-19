# Auth

Hectoday HTTP has no auth system. No middleware, no guards, no decorators. Auth is plain functions.

## The pattern

Write a function that returns your data or a Response:

```ts
interface User {
  id: string;
  name: string;
  role: "admin" | "user";
}

function authenticate(request: Request): User | Response {
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
```

`authenticate` returns either a `User` or a `Response`. Call it in your handler and check with `instanceof`:

```ts
route.post("/users", {
  request: { body: CreateUser },
  resolve: async (c) => {
    const caller = authenticate(c.request);
    if (caller instanceof Response) return caller;
    // caller is User — TypeScript narrowed it

    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    const user = await db.users.create({
      ...c.input.body,
      createdBy: caller.id,
    });

    return Response.json(user, { status: 201 });
  },
});
```

Two lines. The auth call and the check. You see exactly where the request might end — at the `return caller` line. No hidden middleware running somewhere else. No guards you have to trace back to.

## Authorization

Same pattern. Write a function, return `true` or a Response:

```ts
function requireAdmin(user: User): true | Response {
  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return true;
}
```

Use it after authentication:

```ts
resolve: async (c) => {
  const caller = authenticate(c.request);
  if (caller instanceof Response) return caller;

  const admin = requireAdmin(caller);
  if (admin instanceof Response) return admin;

  // caller is User, caller.role is "admin"
  // ...
};
```

Each check is two lines. Each decision boundary is visible.

## Composing checks

Combine common patterns into reusable functions:

```ts
function authenticatedAdmin(request: Request): User | Response {
  const user = authenticate(request);
  if (user instanceof Response) return user;

  const admin = requireAdmin(user);
  if (admin instanceof Response) return admin;

  return user;
}
```

Now a handler that needs admin auth is two lines:

```ts
resolve: async (c) => {
  const caller = authenticatedAdmin(c.request);
  if (caller instanceof Response) return caller;

  // caller is User with admin role
  // ...
};
```

Build whatever combinations your app needs:

```ts
function authenticatedWithOrg(
  request: Request,
  orgId: string,
): { user: User; org: Org } | Response {
  const user = authenticate(request);
  if (user instanceof Response) return user;

  const org = resolveOrgMembership(user, orgId);
  if (org instanceof Response) return org;

  return { user, org };
}
```

```ts
resolve: async (c) => {
  if (!c.input.ok) {
    return Response.json({ error: c.input.issues }, { status: 400 });
  }

  const auth = authenticatedWithOrg(c.request, c.input.params.orgId);
  if (auth instanceof Response) return auth;

  // auth.user and auth.org are both typed
  // ...
};
```

These are just functions. No framework API, no special types, no registration. Write them however you want, put them wherever you want, test them independently.

## Why not guards or middleware?

Guards and middleware hide where requests end. With a middleware chain:

```
app.use(authMiddleware);
app.use(adminMiddleware);
app.get("/users", handler);
```

You can't tell from reading the handler whether auth ran, what it checked, or what response it sends on failure. You have to trace the middleware chain.

With plain functions:

```ts
resolve: async (c) => {
  const caller = authenticate(c.request);
  if (caller instanceof Response) return caller;

  const admin = requireAdmin(caller);
  if (admin instanceof Response) return admin;

  // ...
};
```

Every decision is right here. Read top-to-bottom. Every `return` is visible.

The cost is two lines per check per handler. That's the tradeoff for explicitness.
