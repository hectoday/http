# Rate Limiting

A plain function. Same pattern as auth.

## In-memory rate limiter

```ts
const requests = new Map<string, { count: number; resetAt: number }>();

function rateLimit(request: Request, limit = 100, windowMs = 60_000): true | Response {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();

  const entry = requests.get(ip);
  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > limit) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      },
    );
  }

  return true;
}
```

## Usage in a handler

```ts
resolve: async (c) => {
  const limited = rateLimit(c.request);
  if (limited instanceof Response) return limited;

  // request is within limits
  return Response.json({ data: "ok" });
};
```

Two lines per handler. Same check as auth.

## Per-route limits

Pass different limits for different endpoints:

```ts
resolve: async (c) => {
  const limited = rateLimit(c.request, 10, 60_000); // 10 per minute
  if (limited instanceof Response) return limited;

  // expensive operation
};
```

## Per-user instead of per-IP

Rate limit by user ID after authentication:

```ts
function rateLimitUser(userId: string, limit = 100, windowMs = 60_000): true | Response {
  const entry = requests.get(userId);
  const now = Date.now();

  if (!entry || now > entry.resetAt) {
    requests.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > limit) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      },
    );
  }

  return true;
}
```

```ts
resolve: async (c) => {
  const caller = authenticate(c.request);
  if (caller instanceof Response) return caller;

  const limited = rateLimitUser(caller.id, 50, 60_000);
  if (limited instanceof Response) return limited;

  // ...
};
```

## Redis-backed

For multiple server instances, use Redis instead of a Map:

```ts
async function rateLimit(key: string, limit = 100, windowMs = 60_000): Promise<true | Response> {
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.pexpire(key, windowMs);
  }

  if (current > limit) {
    const ttl = await redis.pttl(key);
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(ttl / 1000)) },
      },
    );
  }

  return true;
}
```

Same interface. Same two-line check in the handler.

## Global rate limiting

Apply to all routes in `onRequest` instead of per-handler:

```ts
const app = setup({
  onRequest: ({ request }) => {
    const limited = rateLimit(request, 1000, 60_000);
    if (limited instanceof Response) throw limited;

    return { startTime: Date.now() };
  },

  routes: [...],

  onError: ({ error }) => {
    if (error instanceof Response) return error;
    return Response.json({ error: "Internal error" }, { status: 500 });
  },
});
```

Since `onRequest` can't return a Response directly, throw it and catch it in `onError`. This is the one place where throwing a Response is the right pattern.
