import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import * as schema from "./schema.ts";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

export function authenticate(request: Request): User | Response {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
    })
    .from(schema.tokens)
    .innerJoin(schema.users, eq(schema.tokens.userId, schema.users.id))
    .where(eq(schema.tokens.token, header.slice(7)))
    .get();

  if (!row) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  return row as User;
}

export function requireAdmin(user: User): true | Response {
  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden — admin role required" }, { status: 403 });
  }
  return true;
}
