import { assertEquals, assertExists } from "@std/assert";
import {
  route,
  type SchemaLike,
  setupHttp,
  type ValidateResult,
  type ValidationPart,
  type Validator,
} from "../mod.ts";

// ==============================
// Mock validator and schemas
// ==============================

type MockSchemaValidateFn<T> = (data: unknown) => T | null;

interface MockSchema<T> extends
  SchemaLike<
    T,
    { issues: Array<{ path: string[]; message: string; code?: string }> }
  > {
  _validate: MockSchemaValidateFn<T>;
}

function createMockSchema<T>(validate: MockSchemaValidateFn<T>): MockSchema<T> {
  return {
    _validate: validate,
    safeParse: (data: unknown) => {
      try {
        const result = validate(data);
        if (result === null) {
          return {
            success: false,
            error: {
              issues: [
                {
                  path: [],
                  message: "Validation failed",
                  code: "custom",
                },
              ],
            },
          };
        }
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            issues: [{ path: [], message: String(error), code: "custom" }],
          },
        };
      }
    },
  };
}

function createMockValidator(): Validator<MockSchema<unknown>> {
  return {
    validate<S extends MockSchema<unknown>>(
      schema: S,
      input: unknown,
      part: ValidationPart,
    ): ValidateResult<unknown, unknown> {
      const result = schema.safeParse(input);

      if (result.success) {
        return { ok: true, value: result.data };
      }

      return {
        ok: false,
        issues: result.error.issues.map((issue) => ({
          part,
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
        error: result.error,
      };
    },
  };
}

// ==============================
// Tests
// ==============================

Deno.test(
  "validation: no schemas means c.input.ok is always true",
  async () => {
    const app = setupHttp({
      handlers: [
        route.get("/test", {
          resolve: (c) => {
            assertEquals(c.input.ok, true);
            return new Response("OK");
          },
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/test"));
    assertEquals(res.status, 200);
  },
);

Deno.test("validation: successful params validation", async () => {
  const paramsSchema = createMockSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") return null;
    return { id: d.id };
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.get("/users/:id", {
        request: {
          params: paramsSchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              { error: { issues: c.input.issues } },
              {
                status: 400,
              },
            );
          }
          const params = c.input.params as { id: string };
          return Response.json({ userId: params.id });
        },
      }),
    ],
  });

  const res = await app.fetch(new Request("http://localhost/users/123"));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { userId: "123" });
});

Deno.test("validation: failed params validation", async () => {
  const paramsSchema = createMockSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string" || !/^\d+$/.test(d.id)) return null;
    return { id: parseInt(d.id) };
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.get("/users/:id", {
        request: {
          params: paramsSchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              {
                error: "Validation failed",
                failed: c.input.failed,
                issues: c.input.issues,
              },
              { status: 400 },
            );
          }
          const params = c.input.params as { id: number };
          return Response.json({ userId: params.id });
        },
      }),
    ],
  });

  const res = await app.fetch(new Request("http://localhost/users/abc"));
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "Validation failed");
  assertEquals(json.failed, ["params"]);
  assertExists(json.issues);
  assertEquals(json.issues.length > 0, true);
});

Deno.test("validation: successful query validation", async () => {
  const querySchema = createMockSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.limit !== "string") return null;
    return { limit: parseInt(d.limit) };
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.get("/posts", {
        request: {
          query: querySchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              { error: { issues: c.input.issues } },
              {
                status: 400,
              },
            );
          }
          const query = c.input.query as { limit: number };
          return Response.json({ limit: query.limit });
        },
      }),
    ],
  });

  const res = await app.fetch(new Request("http://localhost/posts?limit=10"));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { limit: 10 });
});

Deno.test("validation: query handles arrays", async () => {
  const app = setupHttp({
    handlers: [
      route.get("/search", {
        resolve: (c) => {
          const tags = c.raw.query.tag;
          return Response.json({ tags });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/search?tag=a&tag=b&tag=c"),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { tags: ["a", "b", "c"] });
});

Deno.test("validation: successful body validation", async () => {
  const bodySchema = createMockSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.name !== "string" || typeof d.age !== "number") return null;
    return { name: d.name, age: d.age };
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.post("/users", {
        request: {
          body: bodySchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              { error: { issues: c.input.issues } },
              {
                status: 400,
              },
            );
          }
          return Response.json({ created: c.input.body });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", age: 30 }),
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { created: { name: "Alice", age: 30 } });
});

Deno.test("validation: failed body validation", async () => {
  const bodySchema = createMockSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.name !== "string" || typeof d.age !== "number") return null;
    return { name: d.name, age: d.age };
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.post("/users", {
        request: {
          body: bodySchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              { error: "Invalid body", failed: c.input.failed },
              { status: 400 },
            );
          }
          return Response.json({ created: c.input.body });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", age: "thirty" }),
    }),
  );
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "Invalid body");
  assertEquals(json.failed, ["body"]);
});

Deno.test(
  "validation: invalid JSON body creates validation issue",
  async () => {
    const bodySchema = createMockSchema((data: unknown) => {
      return data;
    });

    const app = setupHttp({
      validator: createMockValidator(),
      handlers: [
        route.post("/data", {
          request: {
            body: bodySchema,
          },
          resolve: (c) => {
            if (!c.input.ok) {
              return Response.json(
                {
                  failed: c.input.failed,
                  issues: c.input.issues,
                },
                { status: 400 },
              );
            }
            return Response.json({ body: c.input.body });
          },
        }),
      ],
    });

    const res = await app.fetch(
      new Request("http://localhost/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{",
      }),
    );
    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.failed, ["body"]);
    assertEquals(json.issues.length > 0, true);
    assertEquals(json.issues[0].part, "body");
    assertEquals(json.issues[0].message, "Invalid JSON");
  },
);

Deno.test("validation: multiple schema validations", async () => {
  const paramsSchema = createMockSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.id !== "string") return null;
    return { id: d.id };
  });

  const querySchema = createMockSchema((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (typeof d.include !== "string") return null;
    return { include: d.include };
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.get("/posts/:id", {
        request: {
          params: paramsSchema,
          query: querySchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              { error: "Validation failed", failed: c.input.failed },
              { status: 400 },
            );
          }
          const params = c.input.params as { id: string };
          const query = c.input.query as { include: string };
          return Response.json({
            postId: params.id,
            include: query.include,
          });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/posts/42?include=comments"),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { postId: "42", include: "comments" });
});

Deno.test(
  "validation: c.input.received contains raw values on failure",
  async () => {
    const paramsSchema = createMockSchema(() => null);

    const app = setupHttp({
      validator: createMockValidator(),
      handlers: [
        route.get("/test/:id", {
          request: {
            params: paramsSchema,
          },
          resolve: (c) => {
            if (!c.input.ok) {
              return Response.json({
                received: c.input.received,
                failed: c.input.failed,
              });
            }
            return new Response("OK");
          },
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/test/123"));
    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.received.params, { id: "123" });
    assertEquals(json.failed, ["params"]);
  },
);

Deno.test("validation: body only parsed when body schema exists", async () => {
  const app = setupHttp({
    handlers: [
      route.post("/data", {
        // No body schema - body should NOT be parsed
        resolve: (c) => {
          return Response.json({
            hasBody: c.raw.body !== undefined,
          });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "test" }),
    }),
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  // Body should NOT be parsed since no schema exists
  assertEquals(json.hasBody, false);
});

Deno.test("validation: body parsed when body schema defined", async () => {
  const bodySchema = createMockSchema((data: unknown) => {
    return data;
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.post("/data", {
        request: {
          body: bodySchema,
        },
        resolve: (c) => {
          return Response.json({
            hasBody: c.raw.body !== undefined,
            bodyData: c.raw.body,
          });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "test" }),
    }),
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.hasBody, true);
  assertEquals(json.bodyData, { data: "test" });
});

Deno.test("validation: empty body treated as undefined", async () => {
  const bodySchema = createMockSchema((data: unknown) => {
    if (data === undefined) return null; // Reject undefined
    return data;
  });

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.post("/data", {
        request: {
          body: bodySchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json({ ok: false }, { status: 400 });
          }
          return Response.json({ ok: true, body: c.input.body });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    }),
  );
  // Empty body should be treated as undefined and fail validation
  assertEquals(res.status, 400);
});

Deno.test("validation: validator required when schemas exist", async () => {
  const bodySchema = createMockSchema((data: unknown) => data);

  const app = setupHttp({
    // No validator provided!
    handlers: [
      route.post("/data", {
        request: {
          body: bodySchema,
        },
        resolve: (_c) => {
          return Response.json({ ok: true });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    }),
  );

  // Should return 500 because validator is missing (developer error)
  assertEquals(res.status, 500);
});

Deno.test("validation: multiple parts fail accumulates issues", async () => {
  const paramsSchema = createMockSchema(() => null);
  const querySchema = createMockSchema(() => null);
  const bodySchema = createMockSchema(() => null);

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.post("/test/:id", {
        request: {
          params: paramsSchema,
          query: querySchema,
          body: bodySchema,
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              {
                failed: c.input.failed,
                issueCount: c.input.issues.length,
              },
              { status: 400 },
            );
          }
          return Response.json({ ok: true });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/test/123?q=test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    }),
  );

  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.failed.length, 3);
  assertEquals(json.failed.includes("params"), true);
  assertEquals(json.failed.includes("query"), true);
  assertEquals(json.failed.includes("body"), true);
  assertEquals(json.issueCount >= 3, true);
});

Deno.test(
  "validation: raw values accessible even with successful validation",
  async () => {
    const paramsSchema = createMockSchema((data: unknown) => {
      const d = data as Record<string, unknown>;
      return { id: d.id };
    });

    const app = setupHttp({
      validator: createMockValidator(),
      handlers: [
        route.get("/users/:id", {
          request: {
            params: paramsSchema,
          },
          resolve: (c) => {
            if (!c.input.ok) {
              return Response.json({ error: true }, { status: 400 });
            }
            // Both validated and raw should be accessible
            return Response.json({
              validated: c.input.params,
              raw: c.raw.params,
            });
          },
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/users/123"));
    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.validated.id, "123");
    assertEquals(json.raw.id, "123");
  },
);

Deno.test("validation: guards run after validation", async () => {
  const bodySchema = createMockSchema(() => null); // Always fails

  let guardCalled = false;

  const app = setupHttp({
    validator: createMockValidator(),
    handlers: [
      route.post("/data", {
        request: {
          body: bodySchema,
        },
        guards: [
          (c) => {
            guardCalled = true;
            // Guard can see validation state
            if (!c.input.ok) {
              return {
                deny: Response.json({ guardSawError: true }, { status: 403 }),
              };
            }
            return { allow: true };
          },
        ],
        resolve: (_c) => {
          return Response.json({ ok: true });
        },
      }),
    ],
  });

  const res = await app.fetch(
    new Request("http://localhost/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    }),
  );

  assertEquals(guardCalled, true);
  assertEquals(res.status, 403);
  const json = await res.json();
  assertEquals(json.guardSawError, true);
});
