import { describe, expect, test } from "vite-plus/test";
import { cors } from "../src/cors.ts";
import { route } from "../src/route.ts";
import { setup } from "../src/setup.ts";

describe("cors", () => {
  describe("preflight", () => {
    test("registers OPTIONS route", () => {
      const { preflight } = cors({ origin: "*" });
      const descriptor = preflight(route);
      expect(descriptor.method).toBe("OPTIONS");
      expect(descriptor.path).toBe("/**");
    });

    test("responds with 204", async () => {
      const { preflight } = cors({ origin: "*" });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(new Request("http://localhost/anything", { method: "OPTIONS" }));
      expect(res.status).toBe(204);
    });

    test("sets allow-origin to * for wildcard", async () => {
      const { preflight } = cors({ origin: "*" });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://any.com" },
        }),
      );
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });

    test("does not set allow-origin for wildcard requests without an origin header", async () => {
      const { preflight } = cors({ origin: "*" });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(new Request("http://localhost/test", { method: "OPTIONS" }));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("does not set other preflight headers when the origin is missing", async () => {
      const { preflight } = cors({
        origin: "*",
        maxAge: 3600,
        allowHeaders: ["Content-Type"],
      });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(new Request("http://localhost/test", { method: "OPTIONS" }));
      expect(res.headers.get("access-control-allow-methods")).toBeNull();
      expect(res.headers.get("access-control-allow-headers")).toBeNull();
      expect(res.headers.get("access-control-max-age")).toBeNull();
    });

    test("sets allow-origin for matching origin", async () => {
      const { preflight } = cors({ origin: "https://app.com" });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://app.com" },
        }),
      );
      expect(res.headers.get("access-control-allow-origin")).toBe("https://app.com");
      expect(res.headers.get("vary")).toContain("Origin");
    });

    test("no allow-origin for non-matching origin", async () => {
      const { preflight } = cors({ origin: "https://app.com" });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://evil.com" },
        }),
      );
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("does not set other preflight headers for disallowed origins", async () => {
      const { preflight } = cors({
        origin: "https://app.com",
        maxAge: 3600,
        allowHeaders: ["Content-Type"],
      });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://evil.com" },
        }),
      );
      expect(res.headers.get("access-control-allow-methods")).toBeNull();
      expect(res.headers.get("access-control-allow-headers")).toBeNull();
      expect(res.headers.get("access-control-max-age")).toBeNull();
    });

    test("sets allowed methods", async () => {
      const { preflight } = cors({
        origin: "*",
        methods: ["GET", "POST"],
      });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://any.com" },
        }),
      );
      expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST");
    });

    test("uses default methods when not specified", async () => {
      const { preflight } = cors({ origin: "*" });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://any.com" },
        }),
      );
      const methods = res.headers.get("access-control-allow-methods")!;
      expect(methods).toContain("GET");
      expect(methods).toContain("POST");
      expect(methods).toContain("DELETE");
    });

    test("sets allow-headers", async () => {
      const { preflight } = cors({
        origin: "*",
        allowHeaders: ["Content-Type", "Authorization"],
      });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://any.com" },
        }),
      );
      expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization");
    });

    test("reflects requested headers when allowHeaders is not configured", async () => {
      const { preflight } = cors({ origin: "*" });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: {
            origin: "https://any.com",
            "access-control-request-headers": "x-api-key, authorization",
          },
        }),
      );
      expect(res.headers.get("access-control-allow-headers")).toBe("x-api-key, authorization");
      expect(res.headers.get("vary")).toContain("Access-Control-Request-Headers");
    });

    test("does not set expose-headers on preflight responses", async () => {
      const { preflight } = cors({
        origin: "*",
        exposeHeaders: ["X-Custom", "X-Request-Id"],
      });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://any.com" },
        }),
      );
      expect(res.headers.get("access-control-expose-headers")).toBeNull();
    });

    test("sets max-age", async () => {
      const { preflight } = cors({ origin: "*", maxAge: 3600 });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://any.com" },
        }),
      );
      expect(res.headers.get("access-control-max-age")).toBe("3600");
    });

    test("sets credentials header", async () => {
      const { preflight } = cors({ origin: "https://app.com", credentials: true });
      const app = setup({ routes: [preflight(route)] });
      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: { origin: "https://app.com" },
        }),
      );
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
      expect(res.headers.get("access-control-allow-origin")).toBe("https://app.com");
    });

    test("throws when wildcard origin is combined with credentials", () => {
      expect(() => cors({ origin: "*", credentials: true })).toThrow(
        "Invalid CORS configuration: credentials=true cannot be combined with origin '*'. Use explicit origins instead.",
      );
    });

    test("throws when origin array is empty", () => {
      expect(() => cors({ origin: [] })).toThrow(
        "Invalid CORS configuration: at least one origin must be provided.",
      );
    });

    test("throws when origin contains an empty string", () => {
      expect(() => cors({ origin: ["https://app.com", ""] })).toThrow(
        "Invalid CORS configuration: origin values cannot be empty strings.",
      );
    });
  });

  describe("headers", () => {
    test("adds CORS headers to response", () => {
      const { headers } = cors({ origin: "https://app.com" });
      const req = new Request("http://localhost/test", {
        headers: { origin: "https://app.com" },
      });
      const res = headers(req, Response.json({ ok: true }));
      expect(res.headers.get("access-control-allow-origin")).toBe("https://app.com");
    });

    test("preserves original response body and status", async () => {
      const { headers } = cors({ origin: "*" });
      const req = new Request("http://localhost/test");
      const original = Response.json({ data: 42 }, { status: 201 });
      const res = headers(req, original);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data).toBe(42);
    });

    test("no CORS header for non-matching origin", () => {
      const { headers } = cors({ origin: "https://app.com" });
      const req = new Request("http://localhost/test", {
        headers: { origin: "https://evil.com" },
      });
      const res = headers(req, Response.json({ ok: true }));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("sets expose-headers for allowed origins", () => {
      const { headers } = cors({
        origin: "*",
        exposeHeaders: ["X-Custom", "X-Request-Id"],
      });
      const req = new Request("http://localhost/test", {
        headers: { origin: "https://app.com" },
      });
      const res = headers(req, new Response("ok"));
      expect(res.headers.get("access-control-expose-headers")).toBe("X-Custom, X-Request-Id");
    });

    test("does not set CORS headers for wildcard responses without an origin header", () => {
      const { headers } = cors({
        origin: "*",
        exposeHeaders: ["X-Custom", "X-Request-Id"],
      });
      const req = new Request("http://localhost/test");
      const res = headers(req, new Response("ok"));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-expose-headers")).toBeNull();
    });

    test("does not set expose-headers when the origin is not allowed", () => {
      const { headers } = cors({
        origin: "https://app.com",
        exposeHeaders: ["X-Custom", "X-Request-Id"],
      });
      const req = new Request("http://localhost/test", {
        headers: { origin: "https://evil.com" },
      });
      const res = headers(req, new Response("ok"));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-expose-headers")).toBeNull();
    });

    test("supports multiple origins", () => {
      const { headers } = cors({ origin: ["https://a.com", "https://b.com"] });

      const reqA = new Request("http://localhost/test", {
        headers: { origin: "https://a.com" },
      });
      expect(headers(reqA, new Response("ok")).headers.get("access-control-allow-origin")).toBe(
        "https://a.com",
      );

      const reqB = new Request("http://localhost/test", {
        headers: { origin: "https://b.com" },
      });
      expect(headers(reqB, new Response("ok")).headers.get("access-control-allow-origin")).toBe(
        "https://b.com",
      );

      const reqC = new Request("http://localhost/test", {
        headers: { origin: "https://c.com" },
      });
      expect(
        headers(reqC, new Response("ok")).headers.get("access-control-allow-origin"),
      ).toBeNull();
    });

    test("preserves existing vary values without duplicating Origin", () => {
      const { headers } = cors({ origin: "https://app.com" });
      const req = new Request("http://localhost/test", {
        headers: { origin: "https://app.com" },
      });
      const res = headers(
        req,
        new Response("ok", {
          headers: { vary: "Accept-Encoding, Origin" },
        }),
      );

      expect(res.headers.get("vary")).toBe("Accept-Encoding, Origin");
    });

    test("adds Access-Control-Request-Headers to vary only once", async () => {
      const { preflight } = cors({ origin: "https://app.com" });
      const app = setup({ routes: [preflight(route)] });

      const first = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: {
            origin: "https://app.com",
            "access-control-request-headers": "authorization",
          },
        }),
      );

      expect(first.headers.get("vary")).toBe("Origin, Access-Control-Request-Headers");
    });

    test("does not set credentials header when origin is not allowed", () => {
      const { headers } = cors({ origin: "https://app.com", credentials: true });
      const req = new Request("http://localhost/test", {
        headers: { origin: "https://evil.com" },
      });
      const res = headers(req, new Response("ok"));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    });
  });
});
