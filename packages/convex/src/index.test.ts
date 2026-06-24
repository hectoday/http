import { describe, expect, test, vi } from "vite-plus/test";
import * as z from "zod/v4";
import { createRoutes, setup } from "@hectoday/http";
import { convexRouter, convexRoutes } from "./index";

// A minimal stand-in for the Convex `ActionCtx`. Only the methods used in the
// tests need to exist.
type TestCtx = {
  runQuery: (name: string, args: Record<string, unknown>) => unknown;
  runMutation: (name: string, args: Record<string, unknown>) => unknown;
};

// Convex's `httpActionGeneric` stores the raw handler under `_handler`. Reaching
// for it lets us drive a request through the router exactly as the Convex
// runtime would, without spinning up a backend.
type InternalAction = { _handler: (ctx: TestCtx, request: Request) => Promise<Response> };

function dispatch(
  router: ReturnType<typeof convexRouter>,
  ctx: TestCtx,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const match = router.lookup(url.pathname, request.method as never);
  if (!match) throw new Error(`no route for ${request.method} ${url.pathname}`);
  const action = match[0] as unknown as InternalAction;
  return action._handler(ctx, request);
}

describe("convexRouter", () => {
  test("registers a catch-all prefix route for every Convex method", () => {
    const app = setup({ routes: [] });
    const router = convexRouter(app);

    expect(router.isRouter).toBe(true);
    const methods = router.getRoutes().map(([, method]) => method);
    expect(new Set(methods)).toEqual(new Set(["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]));
    for (const [path] of router.getRoutes()) {
      expect(path).toBe("/*");
    }
  });

  test("honors a custom method list", () => {
    const app = setup({ routes: [] });
    const router = convexRouter(app, { methods: ["GET", "POST"] });
    const methods = router.getRoutes().map(([, method]) => method);
    expect(new Set(methods)).toEqual(new Set(["GET", "POST"]));
  });

  test("convexRoutes builds route descriptors with a Convex-typed env", () => {
    const route = convexRoutes();
    const descriptor = route.get("/health", { resolve: () => new Response("ok") });
    expect(descriptor.method).toBe("GET");
    expect(descriptor.path).toBe("/health");
  });

  test("forwards requests to the app with the Convex ctx as c.env", async () => {
    const route = createRoutes<TestCtx>();

    const app = setup<Record<string, never>, TestCtx>({
      routes: [
        route.get("/listMessages/:userId", {
          request: { params: z.object({ userId: z.string().regex(/^[0-9]+$/) }) },
          resolve: async (c) => {
            if (!c.input.ok) return Response.json(c.input.issues, { status: 400 });
            const messages = await c.env.runQuery("messages:getByAuthor", {
              authorNumber: c.input.params.userId,
            });
            return Response.json(messages);
          },
        }),
      ],
    });

    const runQuery = vi.fn(() => [{ body: "hi" }]);
    const ctx: TestCtx = { runQuery, runMutation: vi.fn() };
    const router = convexRouter(app);

    const res = await dispatch(router, ctx, new Request("http://site.convex.site/listMessages/7"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ body: "hi" }]);
    expect(runQuery).toHaveBeenCalledWith("messages:getByAuthor", { authorNumber: "7" });
  });

  test("runs mutations from a POST handler", async () => {
    const route = createRoutes<TestCtx>();

    const app = setup<Record<string, never>, TestCtx>({
      routes: [
        route.post("/postMessage", {
          request: { body: z.object({ body: z.string(), author: z.string() }) },
          resolve: async (c) => {
            if (!c.input.ok) return Response.json(c.input.issues, { status: 400 });
            await c.env.runMutation("messages:send", c.input.body);
            return new Response("Sent message!");
          },
        }),
      ],
    });

    const runMutation = vi.fn();
    const ctx: TestCtx = { runQuery: vi.fn(), runMutation };
    const router = convexRouter(app);

    const res = await dispatch(
      router,
      ctx,
      new Request("http://site.convex.site/postMessage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "hello", author: "ada" }),
      }),
    );

    expect(await res.text()).toBe("Sent message!");
    expect(runMutation).toHaveBeenCalledWith("messages:send", { body: "hello", author: "ada" });
  });

  test("validation failures are handled by the app, not Convex", async () => {
    const route = createRoutes<TestCtx>();
    const app = setup<Record<string, never>, TestCtx>({
      routes: [
        route.get("/listMessages/:userId", {
          request: { params: z.object({ userId: z.string().regex(/^[0-9]+$/) }) },
          resolve: (c) =>
            c.input.ok ? new Response("ok") : Response.json(c.input.issues, { status: 400 }),
        }),
      ],
    });

    const ctx: TestCtx = { runQuery: vi.fn(), runMutation: vi.fn() };
    const router = convexRouter(app);

    const res = await dispatch(
      router,
      ctx,
      new Request("http://site.convex.site/listMessages/not-a-number"),
    );
    expect(res.status).toBe(400);
  });
});
