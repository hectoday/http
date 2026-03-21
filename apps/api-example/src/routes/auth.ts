import * as z from "zod/v4";
import { eq, and } from "drizzle-orm";
import { route, group } from "@hectoday/http";
import { db } from "../db.ts";
import { nextId } from "../db.ts";
import * as schema from "../schema.ts";
import { type User, authenticate } from "../auth.ts";

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignupBody = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

const UserObject = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
});

const AuthResponse = z.object({
  token: z.string(),
  user: UserObject,
});

const ErrorResponse = z.object({
  error: z.union([z.string(), z.array(z.any())]),
});

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function sanitize(row: { id: string; name: string; email: string; role: string }): User {
  return { id: row.id, name: row.name, email: row.email, role: row.role as User["role"] };
}

export const authRoutes = group([
  route.post("/auth/login", {
    request: { body: LoginBody },
    response: {
      200: AuthResponse,
      400: ErrorResponse,
      401: ErrorResponse,
    },
    resolve: (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const { email, password } = c.input.body;
      const row = db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.email, email), eq(schema.users.password, password)))
        .get();

      if (!row) {
        return Response.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const token = generateToken();
      db.insert(schema.tokens).values({ token, userId: row.id }).run();
      const user = sanitize(row);

      return Response.json({ token, user });
    },
  }),

  route.post("/auth/signup", {
    request: { body: SignupBody },
    response: {
      201: AuthResponse,
      400: ErrorResponse,
      409: ErrorResponse,
    },
    resolve: (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const { name, email, password } = c.input.body;

      const existing = db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .get();

      if (existing) {
        return Response.json({ error: "Email already taken" }, { status: 409 });
      }

      const id = nextId("user_id");
      db.insert(schema.users).values({ id, name, email, password, role: "user" }).run();

      const token = generateToken();
      db.insert(schema.tokens).values({ token, userId: id }).run();
      const user: User = { id, name, email, role: "user" };

      return Response.json({ token, user }, { status: 201 });
    },
  }),

  route.get("/auth/me", {
    response: {
      200: z.object({ user: UserObject }),
      401: ErrorResponse,
    },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;
      return Response.json({ user: caller });
    },
  }),
]);
