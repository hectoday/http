import { describe, expect, test } from "vite-plus/test";
import * as z from "zod/v4";
import { setup } from "../src/setup.ts";
import { createRoutes, route } from "../src/route.ts";

describe("env binding", () => {
  test("c.env defaults to undefined when fetch is called without an env", async () => {
    const app = setup({
      routes: [route.get("/env", { resolve: (c) => Response.json({ env: c.env ?? null }) })],
    });

    const res = await app.request("/env");
    expect(await res.json()).toEqual({ env: null });
  });

  test("the second argument of fetch is exposed as c.env", async () => {
    const env = { runQuery: () => "ran" };
    const app = setup<Record<string, never>, typeof env>({
      routes: [
        route.get("/run", {
          resolve: (c) => Response.json({ result: (c.env as typeof env).runQuery() }),
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/run"), env);
    expect(await res.json()).toEqual({ result: "ran" });
  });

  test("createRoutes types c.env and threads the binding through validation", async () => {
    type Env = { greet: (name: string) => string };
    const r = createRoutes<Env>();

    const app = setup<Record<string, never>, Env>({
      routes: [
        r.get("/hello/:name", {
          request: { params: z.object({ name: z.string() }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json(c.input.issues, { status: 400 });
            // c.env is typed as Env here — no cast needed.
            return Response.json({ message: c.env.greet(c.input.params.name) });
          },
        }),
      ],
    });

    const env: Env = { greet: (name) => `Hi ${name}` };
    const res = await app.fetch(new Request("http://localhost/hello/Ada"), env);
    expect(await res.json()).toEqual({ message: "Hi Ada" });
  });

  test("lifecycle hooks receive the env binding", async () => {
    const env = { id: 42 };
    let onRequestEnv: unknown;
    let onResponseEnv: unknown;

    const app = setup<Record<string, never>, typeof env>({
      onRequest: (args) => {
        onRequestEnv = args.env;
      },
      onResponse: (args) => {
        onResponseEnv = args.env;
        return args.response;
      },
      routes: [route.get("/ping", { resolve: () => new Response("pong") })],
    });

    await app.fetch(new Request("http://localhost/ping"), env);

    expect(onRequestEnv).toBe(env);
    expect(onResponseEnv).toBe(env);
  });

  test("onError receives the env binding", async () => {
    const env = { id: "ctx" };
    let onErrorEnv: unknown;

    const app = setup<Record<string, never>, typeof env>({
      onError: (args) => {
        onErrorEnv = args.env;
        return Response.json({ handled: true }, { status: 500 });
      },
      routes: [
        route.get("/boom", {
          resolve: () => {
            throw new Error("kaboom");
          },
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/boom"), env);
    expect(res.status).toBe(500);
    expect(onErrorEnv).toBe(env);
  });
});
