import { assertEquals } from "@std/assert";
import { route, setup } from "../mod.ts";

Deno.test("onError: receives error and context", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Something went wrong");
        },
      }),
    ],
    onError: ({ error, context }) => {
      const err = error as Error;
      return Response.json(
        {
          error: err.message,
          method: context.request.method,
        },
        { status: 500 },
      );
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Something went wrong");
  assertEquals(body.method, "GET");
});

Deno.test("onError: can access locals from context", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Fail");
        },
      }),
    ],
    onRequest: () => ({
      requestId: "req-789",
    }),
    onError: ({ context }) => {
      return Response.json(
        {
          requestId: context.locals.requestId,
          error: "Internal error",
        },
        { status: 500 },
      );
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.requestId, "req-789");
});

Deno.test("onError: can access route params from context", async () => {
  const app = setup({
    handlers: [
      route.get("/users/:id/fail", {
        resolve: () => {
          throw new Error("User processing failed");
        },
      }),
    ],
    onError: ({ context }) => {
      return Response.json(
        {
          userId: context.raw.params.id,
          error: "Failed to process user",
        },
        { status: 500 },
      );
    },
  });

  const res = await app.fetch(new Request("http://localhost/users/999/fail"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.userId, "999");
});

Deno.test("onError: default handler logs and returns 500", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Unexpected error");
        },
      }),
    ],
    // No custom onError - should use default
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Internal Server Error");
});

Deno.test("onError: async handler works", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          throw new Error("Async test error");
        },
      }),
    ],
    onError: async () => {
      // Simulate async error logging
      await new Promise((resolve) => setTimeout(resolve, 1));
      return Response.json(
        {
          error: "Handled async",
        },
        { status: 500 },
      );
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Handled async");
});

Deno.test("onError: handles errors from guards", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        guards: [
          () => {
            throw new Error("Guard error");
          },
        ],
        resolve: () => new Response("Should not reach here"),
      }),
    ],
    onError: ({ error }) => {
      const err = error as Error;
      return Response.json(
        {
          error: err.message,
          stage: "guard",
        },
        { status: 500 },
      );
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Guard error");
});
