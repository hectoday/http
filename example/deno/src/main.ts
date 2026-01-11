import { group, type GuardFn, route, setupHttp } from "@hectoday/http";
import { zodValidator } from "@hectoday/http-helpers";
import { maxBodyBytes, SIZES } from "@hectoday/http-helpers";
import { z } from "zod";

// ============================================================================
// Guards
// ============================================================================

const requireAuth: GuardFn = (c) => {
  const apiKey = c.request.headers.get("x-api-key");

  if (!apiKey || apiKey !== "secret-key-123") {
    return {
      deny: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    allow: true,
    locals: {
      userId: "user-123",
      role: "admin",
    },
  };
};

// ============================================================================
// Routes
// ============================================================================

const healthHandler = route.get("/health", {
  resolve: () => {
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  },
});

const rootHandler = route.get("/", {
  resolve: (c) => {
    return Response.json({
      message: "Welcome to Hectoday HTTP!",
      requestId: c.locals.requestId,
    });
  },
});

const getUserHandler = route.get("/users/:id", {
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid params", issues: c.input.issues },
        { status: 400 },
      );
    }

    // Type inference works! c.input.params is { id: string }
    const { id } = c.input.params;
    return Response.json({
      id,
      name: "John Doe",
      email: "john@example.com",
    });
  },
});

const listUsersHandler = route.get("/users", {
  request: {
    query: z.object({
      limit: z.string().transform(Number),
      page: z.string().transform(Number),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid query", issues: c.input.issues },
        { status: 400 },
      );
    }

    // Type inference works! c.input.query is { limit: number; page: number }
    const { limit, page } = c.input.query;
    return Response.json({
      users: [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ],
      pagination: { page, limit, total: 100 },
    });
  },
});

const createUserHandler = route.post("/users", {
  guards: [maxBodyBytes(1 * SIZES.MB)], // Limit request body to 1MB
  request: {
    body: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid body", issues: c.input.issues },
        { status: 400 },
      );
    }

    // Type inference works! c.input.body is { name: string; email: string }
    const { name, email } = c.input.body;
    return Response.json(
      {
        id: crypto.randomUUID(),
        name,
        email,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  },
});

const searchHandler = route.get("/search", {
  resolve: (c) => {
    const tags = c.raw.query.tag;
    const category = c.raw.query.category;

    return Response.json({
      query: {
        tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
        category,
      },
      results: [],
    });
  },
});

const protectedHandler = route.get("/protected", {
  resolve: (c) => {
    return Response.json({
      message: "Protected resource",
      user: {
        id: c.locals.userId,
        role: c.locals.role,
      },
    });
  },
});

const uploadFileHandler = route.post("/upload", {
  guards: [maxBodyBytes(10 * SIZES.MB)], // Limit file uploads to 10MB
  request: {
    body: z.object({
      filename: z.string(),
      data: z.string(), // Base64 encoded data
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid upload data", issues: c.input.issues },
        { status: 400 },
      );
    }

    const { filename, data } = c.input.body;
    return Response.json({
      success: true,
      fileId: crypto.randomUUID(),
      filename,
      size: data.length,
      uploadedAt: new Date().toISOString(),
    });
  },
});

// ============================================================================
// Setup
// ============================================================================

const publicRoutes = [
  healthHandler,
  rootHandler,
  listUsersHandler,
  getUserHandler,
  searchHandler,
  uploadFileHandler,
];

const protectedRoutes = group({
  guards: [requireAuth],
  handlers: [protectedHandler, createUserHandler],
});

const app = setupHttp({
  validator: zodValidator,
  handlers: [...publicRoutes, ...protectedRoutes],

  onRequest: (request) => {
    const requestId = request.headers.get("x-request-id") ||
      crypto.randomUUID();
    return { requestId };
  },

  onResponse: (c, res) => {
    // Use requestId from locals (set by onRequest)
    const requestId = String(c.locals.requestId);
    const headers = new Headers(res.headers);
    headers.set("x-request-id", requestId);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  },
});

Deno.serve({ port: 8000 }, app.fetch);
