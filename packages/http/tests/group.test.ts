import { describe, expect, test } from "vite-plus/test";
import { group } from "../src/group.ts";
import { route } from "../src/route.ts";

describe("group", () => {
  test("returns the same array", () => {
    const routes = [
      route.get("/a", { resolve: () => new Response("a") }),
      route.post("/b", { resolve: () => new Response("b") }),
    ];
    const result = group(routes);
    expect(result).toBe(routes);
  });

  test("returns empty array for empty input", () => {
    const result = group([]);
    expect(result).toEqual([]);
  });

  test("preserves route descriptors", () => {
    const routes = group([
      route.get("/users", { resolve: () => new Response("ok") }),
      route.delete("/users/:id", { resolve: () => new Response("ok") }),
    ]);
    expect(routes).toHaveLength(2);
    expect(routes[0].method).toBe("GET");
    expect(routes[0].path).toBe("/users");
    expect(routes[1].method).toBe("DELETE");
    expect(routes[1].path).toBe("/users/:id");
  });

  test("groups can be spread into setup routes", () => {
    const userRoutes = group([route.get("/users", { resolve: () => Response.json([]) })]);
    const adminRoutes = group([route.get("/admin", { resolve: () => Response.json({}) })]);
    const all = [...userRoutes, ...adminRoutes];
    expect(all).toHaveLength(2);
  });
});
