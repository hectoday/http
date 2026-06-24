/// <reference types="vite-plus/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import schema from "./schema";

// `import.meta.glob` registers every Convex module (functions + http router) so
// convex-test can simulate the real backend in-process.
const modules = import.meta.glob("./**/*.ts");

// `t.fetch` routes through the `convex/http.ts` default export — the real Convex
// httpRouter — so these tests exercise pathPrefix matching and full-pathname
// passthrough into the Hectoday app, not just `app.fetch` in isolation.
describe("convex http router (via convex-test)", () => {
  test("POST then GET round-trips through the router and the database", async () => {
    const t = convexTest(schema, modules);

    const sent = await t.fetch("/postMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ author: "ada", body: "hello" }),
    });
    expect(sent.status).toBe(200);
    expect(await sent.text()).toBe("Sent message!");

    // Nested path segment must survive Convex's prefix routing.
    const byAuthor = await t.fetch("/listMessages/ada");
    expect(byAuthor.status).toBe(200);
    expect(await byAuthor.json()).toMatchObject([{ author: "ada", body: "hello" }]);

    const all = await t.fetch("/messages");
    expect(all.status).toBe(200);
    expect(await all.json()).toHaveLength(1);
  });

  test("validation errors are returned by the app", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/postMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ author: "", body: "" }),
    });
    expect(res.status).toBe(400);
  });

  test("unknown paths hit the app's 404, served through the catch-all", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/does-not-exist");
    expect(res.status).toBe(404);
  });

  test("HEAD is served by the GET route with no body", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/messages", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  test("an authenticated route rejects anonymous callers", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/sendAs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "hi" }),
    });
    expect(res.status).toBe(401);
  });

  test("an authenticated route uses the identity from c.env.auth", async () => {
    const t = convexTest(schema, modules);
    const asAda = t.withIdentity({ name: "Ada", subject: "user|ada" });

    const res = await asAda.fetch("/sendAs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "from ada" }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ author: "Ada", body: "from ada" });

    // The message was stored under the authenticated identity.
    const byAuthor = await t.fetch("/listMessages/Ada");
    expect(await byAuthor.json()).toMatchObject([{ author: "Ada", body: "from ada" }]);
  });

  test("OPTIONS preflight returns CORS headers", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/postMessage", {
      method: "OPTIONS",
      headers: { origin: "https://example.com", "access-control-request-method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
