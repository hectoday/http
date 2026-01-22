import { assertEquals } from "@std/assert";
import { route, setup } from "../mod.ts";

Deno.test("onResponse: receives context and response", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          return new Response("original");
        },
      }),
    ],
    onResponse: ({ context, response }) => {
      const headers = new Headers(response.headers);
      headers.set("x-method", context.request.method);
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-method"), "GET");
  assertEquals(await res.text(), "original");
});

Deno.test("onResponse: can access locals from context", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          return new Response("ok");
        },
      }),
    ],
    onRequest: () => ({
      requestId: "req-123",
    }),
    onResponse: ({ context, response }) => {
      const headers = new Headers(response.headers);
      headers.set("x-request-id", String(context.locals.requestId));
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-request-id"), "req-123");
});

Deno.test("onResponse: can access route params from context", async () => {
  const app = setup({
    handlers: [
      route.get("/users/:id", {
        resolve: () => {
          return new Response("user data");
        },
      }),
    ],
    onResponse: ({ context, response }) => {
      const headers = new Headers(response.headers);
      headers.set("x-user-id", String(context.raw.params.id));
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/users/456"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-user-id"), "456");
});

Deno.test("onResponse: can modify response status", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          return new Response("ok", { status: 200 });
        },
      }),
    ],
    onResponse: ({ response }) => {
      // Force all responses to 202 Accepted
      return new Response(response.body, {
        status: 202,
        headers: response.headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 202);
});

Deno.test("onResponse: async handler works", async () => {
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: () => {
          return new Response("ok");
        },
      }),
    ],
    onResponse: async ({ response }) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 1));
      const headers = new Headers(response.headers);
      headers.set("x-async", "true");
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    },
  });

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("x-async"), "true");
});
