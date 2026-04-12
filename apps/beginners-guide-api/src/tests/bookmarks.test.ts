import { describe, test, expect } from "vite-plus/test";
import { app } from "../server";

describe("Bookmarks API", () => {
  test("health check is public", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });

  test("bookmarks require auth", async () => {
    const res = await app.request("/bookmarks");
    expect(res.status).toBe(401);
  });

  test("rejects invalid input", async () => {
    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: { Authorization: "Bearer alice" },
      body: { url: "not-a-url" },
    });
    expect(res.status).toBe(400);
  });

  test("creates and retrieves a bookmark", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { Authorization: "Bearer alice" },
      body: { url: "https://example.com", title: "Example" },
    });
    expect(createRes.status).toBe(201);
    const bookmark = (await createRes.json()) as { id: string };

    const getRes = await app.request(`/bookmarks/${bookmark.id}`, {
      headers: { Authorization: "Bearer alice" },
    });
    expect(getRes.status).toBe(200);
  });

  test("includes response headers", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("x-request-id")).toBeDefined();
    expect(res.headers.get("x-response-time")).toMatch(/ms$/);
  });

  test("returns 404 for unknown routes", async () => {
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });

  test("user cannot access another user's bookmark", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { Authorization: "Bearer alice" },
      body: { url: "https://private.com", title: "Private" },
    });
    const bookmark = (await createRes.json()) as { id: string };

    const res = await app.request(`/bookmarks/${bookmark.id}`, {
      headers: { Authorization: "Bearer bob" },
    });
    expect(res.status).toBe(403);
  });
});
