# Caching

The framework has no caching layer. Caching is two things: HTTP headers on responses and a data access pattern on the server. Both are your code.

## HTTP caching

Set `Cache-Control` on your responses:

```ts
route.get("/users/:id", {
  request: { params: z.object({ id: z.string().uuid() }) },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    const user = await db.users.get(c.input.params.id);
    if (!user) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(user, {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=30",
      },
    });
  },
});
```

This tells clients and CDNs to cache the response for 60 seconds and serve stale content for another 30 seconds while revalidating in the background.

For default cache headers across all responses, use `onResponse`:

```ts
onResponse: ({ request, response }) => {
  const headers = new Headers(response.headers);

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  return new Response(response.body, { status: response.status, headers });
};
```

Handlers that set their own `Cache-Control` keep it. Everything else defaults to `no-store`.

## Server-side caching

A reusable cache wrapper in 10 lines:

```ts
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;

  const result = await fn();
  await redis.set(key, JSON.stringify(result), "EX", ttlMs / 1000);
  return result;
}
```

Use it in handlers:

```ts
resolve: async (c) => {
  if (!c.input.ok) {
    return Response.json({ error: c.input.issues }, { status: 400 });
  }

  const user = await cached(`user:${c.input.params.id}`, 60_000, () =>
    db.users.get(c.input.params.id),
  );

  if (!user) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(user);
};
```

Check, compute, store, return. That's the whole pattern.

## Invalidation

When data changes, delete the cached entry:

```ts
route.put("/users/:id", {
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ name: z.string(), email: z.string().email() }),
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    const user = await db.users.update(c.input.params.id, c.input.body);
    await redis.del(`user:${c.input.params.id}`);

    return Response.json(user);
  },
});
```

Invalidate, don't update. Updating the cache means replicating mutation logic in two places. Deleting it means the next read recomputes a fresh value.

## ETag support

For conditional requests, compute an ETag from the response body:

```ts
async function jsonWithETag(body: unknown, request: Request): Promise<Response> {
  const json = JSON.stringify(body);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  const etag = `"${Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  return new Response(json, {
    headers: {
      "content-type": "application/json",
      etag: etag,
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
```

Use it in a handler:

```ts
resolve: async (c) => {
  const user = await db.users.get(c.input.params.id);
  if (!user) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return jsonWithETag(user, c.request);
};
```

The client sends `If-None-Match` with the ETag. If the data hasn't changed, you return `304 Not Modified` with no body. The client uses its local copy.

## When not to cache

Don't cache when:

- The underlying operation is already fast (simple key lookups, in-memory data)
- The data changes on every request (real-time counters, live feeds)
- The cache key space is unbounded (random search queries, per-session data)
- The hit rate will be low (high cardinality, unique per-user data)

A cache miss is slower than no cache at all. You pay for the lookup, the computation, and the write. Only cache when the hit rate justifies it.

## In-memory alternative

If you don't need Redis, a `Map` works for single-instance deployments:

```ts
const store = new Map<string, { data: unknown; expiresAt: number }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = store.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;

  const result = await fn();
  store.set(key, { data: result, expiresAt: Date.now() + ttlMs });
  return result;
}
```

No dependencies. Lost on restart. Fine for dev and small-scale production.
