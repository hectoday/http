// runtime_test.ts

import { assertEquals } from "@std/assert";
import { route, setupHttp, type Validator } from "../mod.ts";

Deno.test("setupHttp returns object with fetch method", () => {
  const app = setupHttp([]);
  assertEquals(typeof app.fetch, "function");
});

Deno.test("setupHttp.fetch matches GET route", async () => {
  const app = setupHttp([
    route.get("/hello", {
      resolve: () => new Response("Hello World"),
    }),
  ]);

  const req = new Request("http://localhost/hello", { method: "GET" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "Hello World");
});

Deno.test("setupHttp.fetch matches POST route", async () => {
  const app = setupHttp([
    route.post("/data", {
      resolve: () => new Response("Posted"),
    }),
  ]);

  const req = new Request("http://localhost/data", { method: "POST" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "Posted");
});

Deno.test("setupHttp.fetch returns 404 for unmatched path", async () => {
  const app = setupHttp([
    route.get("/exists", {
      resolve: () => new Response("OK"),
    }),
  ]);

  const req = new Request("http://localhost/not-found", { method: "GET" });
  const res = await app.fetch(req);

  assertEquals(res.status, 404);
  assertEquals(await res.text(), "Not Found");
});

Deno.test("setupHttp.fetch returns 404 for unmatched method", async () => {
  const app = setupHttp([
    route.get("/test", {
      resolve: () => new Response("OK"),
    }),
  ]);

  const req = new Request("http://localhost/test", { method: "POST" });
  const res = await app.fetch(req);

  assertEquals(res.status, 404);
});

Deno.test("setupHttp.fetch handler receives request and body", async () => {
  // Simple schema that accepts anything
  const bodySchema = {
    safeParse: (data: unknown) =>
      ({ success: true as const, data }) as
        | { success: true; data: unknown }
        | { success: false; error: unknown },
  };

  // Simple validator
  const validator = {
    validate: (schema: typeof bodySchema, input: unknown, _part: string) => {
      const result = schema.safeParse(input);
      if (result.success) {
        return { ok: true as const, value: result.data };
      }
      return { ok: false as const, issues: [], error: result.error };
    },
  } as Validator<typeof bodySchema>;

  const app = setupHttp({
    validator,
    handlers: [
      route.post("/echo", {
        request: {
          body: bodySchema,
        },
        resolve: (c) => {
          // Body is already parsed to c.raw.body when schema is defined
          const body = c.raw.body as { message: string };
          return Response.json(body);
        },
      }),
    ],
  });

  const req = new Request("http://localhost/echo", {
    method: "POST",
    body: JSON.stringify({ message: "test body" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await app.fetch(req);

  assertEquals(await res.json(), { message: "test body" });
});

Deno.test("setupHttp.fetch matches HEAD route", async () => {
  const app = setupHttp([
    route.head("/resource", {
      resolve: () =>
        new Response(null, {
          headers: { "Content-Length": "100" },
        }),
    }),
  ]);

  const req = new Request("http://localhost/resource", { method: "HEAD" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Length"), "100");
});

Deno.test("setupHttp.fetch matches PATCH route", async () => {
  const app = setupHttp([
    route.patch("/users/1", {
      resolve: () => new Response("Patched"),
    }),
  ]);

  const req = new Request("http://localhost/users/1", { method: "PATCH" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "Patched");
});

Deno.test("setupHttp.fetch matches OPTIONS route", async () => {
  const app = setupHttp([
    route.options("/api", {
      resolve: () =>
        new Response(null, {
          headers: { Allow: "GET, POST, OPTIONS" },
        }),
    }),
  ]);

  const req = new Request("http://localhost/api", { method: "OPTIONS" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Allow"), "GET, POST, OPTIONS");
});

Deno.test("setupHttp.fetch matches route.all for any method", async () => {
  const app = setupHttp([
    route.all("/wildcard", {
      resolve: () => new Response("Any method"),
    }),
  ]);

  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

  for (const method of methods) {
    const req = new Request("http://localhost/wildcard", { method });
    const res = await app.fetch(req);
    assertEquals(res.status, 200);
    if (method !== "HEAD") {
      assertEquals(await res.text(), "Any method");
    }
  }
});

Deno.test("setupHttp.fetch matches custom method with route.on", async () => {
  const app = setupHttp([
    route.on("PROPFIND", "/webdav", {
      resolve: () => new Response("PROPFIND response"),
    }),
  ]);

  const req = new Request("http://localhost/webdav", { method: "PROPFIND" });
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "PROPFIND response");
});

Deno.test(
  "setupHttp.fetch route.all doesn't interfere with specific routes",
  async () => {
    const app = setupHttp([
      route.get("/test", {
        resolve: () => new Response("GET specific"),
      }),
      route.all("/test", {
        resolve: () => new Response("Any method"),
      }),
    ]);

    const getReq = new Request("http://localhost/test", { method: "GET" });
    const getRes = await app.fetch(getReq);
    assertEquals(await getRes.text(), "GET specific");

    const postReq = new Request("http://localhost/test", { method: "POST" });
    const postRes = await app.fetch(postReq);
    assertEquals(await postRes.text(), "Any method");
  },
);
