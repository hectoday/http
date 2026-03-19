import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "./schema.ts";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Create tables if they don't exist
db.run(sql`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
)`);

// Seed if empty
const userCount = db
  .select({ count: sql<number>`count(*)` })
  .from(schema.users)
  .get()!.count;
if (userCount === 0) {
  db.insert(schema.users)
    .values([
      {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        password: "admin123",
        role: "admin",
      },
      { id: "user-2", name: "Bob", email: "bob@example.com", password: "user123", role: "user" },
    ])
    .run();

  db.insert(schema.tokens)
    .values([
      { token: "demo-token", userId: "user-1" },
      { token: "user-token", userId: "user-2" },
    ])
    .run();

  db.insert(schema.bookmarks)
    .values([
      {
        id: "bm-1",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/Request",
        title: "Request - Web APIs | MDN",
        tags: ["web", "standards"],
        createdBy: "user-1",
        createdAt: "2026-03-17T00:00:00Z",
      },
      {
        id: "bm-2",
        url: "https://zod.dev",
        title: "Zod - TypeScript-first schema validation",
        tags: ["typescript", "validation"],
        createdBy: "user-1",
        createdAt: "2026-03-17T00:01:00Z",
      },
      {
        id: "bm-3",
        url: "https://vite.dev",
        title: "Vite - Next Generation Frontend Tooling",
        tags: ["tooling"],
        createdBy: "user-2",
        createdAt: "2026-03-17T00:02:00Z",
      },
    ])
    .run();

  db.insert(schema.counters)
    .values([
      { name: "user_id", value: 2 },
      { name: "bookmark_id", value: 3 },
    ])
    .run();
}

export function nextId(name: string): string {
  const row = db
    .update(schema.counters)
    .set({ value: sql`value + 1` })
    .where(sql`name = ${name}`)
    .returning({ value: schema.counters.value })
    .get()!;
  return `${name === "user_id" ? "user" : "bm"}-${row.value}`;
}
