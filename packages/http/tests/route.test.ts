import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import { route } from "../src/route.ts";

describe("route", () => {
  test("route.get creates GET descriptor", () => {
    const r = route.get("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("GET");
    expect(r.path).toBe("/test");
    expect(typeof r.config.resolve).toBe("function");
  });

  test("route.post creates POST descriptor", () => {
    const r = route.post("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/test");
  });

  test("route.put creates PUT descriptor", () => {
    const r = route.put("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("PUT");
  });

  test("route.patch creates PATCH descriptor", () => {
    const r = route.patch("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("PATCH");
  });

  test("route.delete creates DELETE descriptor", () => {
    const r = route.delete("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("DELETE");
  });

  test("route.head creates HEAD descriptor", () => {
    const r = route.head("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("HEAD");
  });

  test("route.options creates OPTIONS descriptor", () => {
    const r = route.options("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("OPTIONS");
  });

  test("route.all creates descriptor with empty method", () => {
    const r = route.all("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("");
  });

  test("preserves request schemas", () => {
    const paramsSchema = z.object({ id: z.string() });
    const querySchema = z.object({ q: z.string() });
    const bodySchema = z.object({ name: z.string() });

    const r = route.post("/test/:id", {
      request: { params: paramsSchema, query: querySchema, body: bodySchema },
      resolve: () => new Response("ok"),
    });

    expect(r.config.request?.params).toBe(paramsSchema);
    expect(r.config.request?.query).toBe(querySchema);
    expect(r.config.request?.body).toBe(bodySchema);
  });

  test("preserves response schemas", () => {
    const okSchema = z.object({ id: z.string() });
    const errSchema = z.object({ error: z.string() });

    const r = route.get("/test", {
      response: { 200: okSchema, 400: errSchema },
      resolve: () => new Response("ok"),
    });

    expect(r.config.response?.[200]).toBe(okSchema);
    expect(r.config.response?.[400]).toBe(errSchema);
  });

  test("config without request schemas", () => {
    const r = route.get("/test", { resolve: () => new Response("ok") });
    expect(r.config.request).toBeUndefined();
  });

  test("method is uppercased", () => {
    const r = route.get("/test", { resolve: () => new Response("ok") });
    expect(r.method).toBe("GET");
  });
});
