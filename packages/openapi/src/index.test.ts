import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import { route } from "@hectoday/http";
import { openapi } from "./index";
import type { OpenApiConfig } from "./index";

const securitySchemesTypecheck = {
  bearerAuth: { type: "http", scheme: "bearer" },
  apiKeyAuth: { type: "apiKey", name: "x-api-key", in: "header" },
  oauthAuth: {
    type: "oauth2",
    flows: {
      authorizationCode: {
        authorizationUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        scopes: { read: "Read access" },
      },
    },
  },
  oidcAuth: {
    type: "openIdConnect",
    openIdConnectUrl: "https://example.com/.well-known/openid-configuration",
  },
} satisfies NonNullable<OpenApiConfig["securitySchemes"]>;

void securitySchemesTypecheck;

const invalidOAuth2SecurityScheme = {
  brokenOAuth: {
    type: "oauth2",
    // @ts-expect-error oauth2 security schemes must define at least one flow
    flows: {},
  },
} satisfies NonNullable<OpenApiConfig["securitySchemes"]>;

const invalidAuthorizationCodeFlow = {
  brokenAuthCode: {
    type: "oauth2",
    flows: {
      // @ts-expect-error authorizationCode flow requires both authorizationUrl and tokenUrl
      authorizationCode: {
        scopes: { read: "Read access" },
      },
    },
  },
} satisfies NonNullable<OpenApiConfig["securitySchemes"]>;

void invalidOAuth2SecurityScheme;
void invalidAuthorizationCodeFlow;

describe("openapi", () => {
  test("generates spec from routes with schemas", () => {
    const routes = [
      route.get("/users", {
        request: {
          query: z.object({
            page: z.coerce.number().int().min(1).default(1),
          }),
        },
        response: {
          200: z.object({ users: z.array(z.string()) }),
        },
        resolve: () => Response.json({ users: [] }),
      }),
      route.post("/users", {
        request: {
          body: z.object({
            name: z.string(),
            email: z.string().email(),
          }),
        },
        response: {
          201: z.object({ id: z.string() }),
        },
        resolve: () => Response.json({ id: "1" }, { status: 201 }),
      }),
      route.get("/users/:id", {
        request: {
          params: z.object({ id: z.string() }),
        },
        resolve: () => Response.json({ id: "1", name: "Alice" }),
      }),
    ];

    const { spec, docs } = openapi(routes, {
      info: { title: "Test API", version: "1.0.0" },
    });

    const specRoute = spec(route);
    expect(specRoute.method).toBe("GET");
    expect(specRoute.path).toBe("/openapi.json");

    const docsRoute = docs(route);
    expect(docsRoute.method).toBe("GET");
    expect(docsRoute.path).toBe("/docs");
  });

  test("spec route serves JSON document", async () => {
    const routes = [
      route.get("/health", {
        response: { 200: z.object({ ok: z.boolean() }) },
        resolve: () => Response.json({ ok: true }),
      }),
    ];

    const { spec } = openapi(routes, {
      info: { title: "Health API", version: "0.1.0" },
    });

    const specRoute = spec(route);
    const response = await specRoute.config.resolve({
      request: new Request("http://localhost/openapi.json"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    expect(response.status).toBe(200);
    const doc = await response.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Health API");
    expect(doc.paths["/health"]).toBeDefined();
    expect(doc.paths["/health"].get).toBeDefined();
  });

  test("docs route serves HTML", async () => {
    const { docs } = openapi([], {
      info: { title: "Test", version: "1.0.0" },
    });

    const docsRoute = docs(route);
    const response = await docsRoute.config.resolve({
      request: new Request("http://localhost/docs"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    expect(response.headers.get("content-type")).toBe("text/html");
    const html = await response.text();
    expect(html).toContain("@scalar/api-reference");
    expect(html).toContain("/openapi.json");
  });

  test("converts path params from :id to {id}", async () => {
    const routes = [
      route.get("/users/:userId/posts/:postId", {
        request: {
          params: z.object({ userId: z.string(), postId: z.string() }),
        },
        resolve: () => Response.json({}),
      }),
    ];

    const { spec } = openapi(routes, {
      info: { title: "Test", version: "1.0.0" },
    });

    const response = await spec(route).config.resolve({
      request: new Request("http://localhost/openapi.json"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    const doc = await response.json();
    expect(doc.paths["/users/{userId}/posts/{postId}"]).toBeDefined();
  });

  test("skips catch-all and methodless routes", async () => {
    const routes = [
      route.all("/catch", {
        resolve: () => new Response("ok"),
      }),
      route.get("/real", {
        resolve: () => Response.json({ ok: true }),
      }),
    ];

    const { spec } = openapi(routes, {
      info: { title: "Test", version: "1.0.0" },
    });

    const response = await spec(route).config.resolve({
      request: new Request("http://localhost/openapi.json"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    const doc = await response.json();
    expect(doc.paths["/catch"]).toBeUndefined();
    expect(doc.paths["/real"]).toBeDefined();
  });

  test("skips named and nested wildcard paths", async () => {
    const routes = [
      route.get("/files/**", {
        resolve: () => Response.json({ ok: true }),
      }),
      route.get("/files/**:path", {
        resolve: () => Response.json({ ok: true }),
      }),
      route.get("/users/:id", {
        request: { params: z.object({ id: z.string() }) },
        resolve: () => Response.json({ ok: true }),
      }),
    ];

    const { spec } = openapi(routes, {
      info: { title: "Test", version: "1.0.0" },
    });

    const response = await spec(route).config.resolve({
      request: new Request("http://localhost/openapi.json"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    const doc = await response.json();
    expect(doc.paths["/files/**"]).toBeUndefined();
    expect(doc.paths["/files/**:path"]).toBeUndefined();
    expect(doc.paths["/users/{id}"]).toBeDefined();
  });

  test("custom spec and docs paths", () => {
    const { spec, docs } = openapi([], {
      info: { title: "Test", version: "1.0.0" },
      specPath: "/api/spec.json",
      docsPath: "/api/docs",
    });

    expect(spec(route).path).toBe("/api/spec.json");
    expect(docs(route).path).toBe("/api/docs");
  });

  test("includes servers and tags in document", async () => {
    const { spec } = openapi([], {
      info: { title: "Test", version: "1.0.0" },
      servers: [{ url: "https://api.example.com", description: "Production" }],
      tags: [{ name: "users", description: "User operations" }],
    });

    const response = await spec(route).config.resolve({
      request: new Request("http://localhost/openapi.json"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    const doc = await response.json();
    expect(doc.servers).toEqual([{ url: "https://api.example.com", description: "Production" }]);
    expect(doc.tags).toEqual([{ name: "users", description: "User operations" }]);
  });

  test("request body is included for POST routes", async () => {
    const routes = [
      route.post("/items", {
        request: {
          body: z.object({ name: z.string() }),
        },
        resolve: () => Response.json({}, { status: 201 }),
      }),
    ];

    const { spec } = openapi(routes, {
      info: { title: "Test", version: "1.0.0" },
    });

    const response = await spec(route).config.resolve({
      request: new Request("http://localhost/openapi.json"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    const doc = await response.json();
    const post = doc.paths["/items"].post;
    expect(post.requestBody).toBeDefined();
    expect(post.requestBody.content["application/json"]).toBeDefined();
  });

  test("omits content for status codes that cannot include a response body", async () => {
    const routes = [
      route.get("/cache", {
        response: {
          204: z.object({ ok: z.boolean() }),
          205: z.object({ reset: z.boolean() }),
          304: z.object({ cached: z.boolean() }),
        },
        resolve: () => new Response(null, { status: 204 }),
      }),
    ];

    const { spec } = openapi(routes, {
      info: { title: "Test", version: "1.0.0" },
    });

    const response = await spec(route).config.resolve({
      request: new Request("http://localhost/openapi.json"),
      input: { ok: true, params: {}, query: {}, body: undefined, issues: [], failed: [] },
      locals: {},
    });

    const doc = await response.json();
    const responses = doc.paths["/cache"].get.responses;
    expect(responses["204"].content).toBeUndefined();
    expect(responses["205"].content).toBeUndefined();
    expect(responses["304"].content).toBeUndefined();
  });
});
