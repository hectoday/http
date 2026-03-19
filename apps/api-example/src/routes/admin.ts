import "zod-openapi/extend";
import { z } from "zod";
import { route, group } from "@hectoday/http";
import { authenticate, requireAdmin } from "../auth.ts";

export const adminRoutes = group([
  route.get("/admin/stats", {
    response: {
      200: z
        .object({
          stats: z.object({
            uptime: z.number(),
            memory: z.number(),
          }),
        })
        .openapi({
          example: {
            stats: { uptime: 86400, memory: 134217728 },
          },
        }),
      401: z.object({ error: z.string() }),
      403: z.object({ error: z.string() }),
    },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      const admin = requireAdmin(caller);
      if (admin instanceof Response) return admin;

      return Response.json({
        stats: {
          uptime: process.uptime(),
          memory: process.memoryUsage().rss,
        },
      });
    },
  }),
]);
