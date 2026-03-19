import { http, HttpResponse } from "msw";
import { fromOpenApi } from "@msw/source/open-api";

export const adminHandlers = [
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),
];

export async function adminOpenApiHandlers() {
  const res = await fetch("/api/openapi.json");
  const spec = await res.json();
  spec.servers = [{ url: "/api" }];
  spec.paths = { "/admin/stats": { get: spec.paths["/admin/stats"].get } };
  return fromOpenApi(spec);
}
