import { describe, expect, test } from "vite-plus/test";
import { setup } from "../src/setup.ts";
import { route } from "../src/route.ts";

describe("HEAD requests", () => {
  test("falls back to the GET route and strips the body", async () => {
    const app = setup({
      routes: [
        route.get("/thing", {
          resolve: () => Response.json({ hello: "world" }, { headers: { "x-custom": "1" } }),
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/thing", { method: "HEAD" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-custom")).toBe("1");
    expect(await res.text()).toBe("");
  });

  test("an explicit HEAD route takes precedence over GET", async () => {
    const app = setup({
      routes: [
        route.get("/thing", { resolve: () => new Response("from get") }),
        route.head("/thing", {
          resolve: () => new Response(null, { status: 204, headers: { "x-head": "yes" } }),
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/thing", { method: "HEAD" }));

    expect(res.status).toBe(204);
    expect(res.headers.get("x-head")).toBe("yes");
  });

  test("HEAD with no matching GET route still 404s", async () => {
    const app = setup({
      routes: [route.get("/thing", { resolve: () => new Response("ok") })],
    });

    const res = await app.fetch(new Request("http://localhost/missing", { method: "HEAD" }));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  test("HEAD runs onResponse hooks like GET", async () => {
    const app = setup({
      onResponse: ({ response }) => {
        response.headers.set("x-hooked", "1");
        return response;
      },
      routes: [route.get("/thing", { resolve: () => Response.json({ ok: true }) })],
    });

    const res = await app.fetch(new Request("http://localhost/thing", { method: "HEAD" }));
    expect(res.headers.get("x-hooked")).toBe("1");
    expect(await res.text()).toBe("");
  });
});
