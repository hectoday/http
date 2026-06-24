import { setup, cors } from "@hectoday/http";
import { convexRouter, convexRoutes } from "@hectoday/convex";
import { z } from "zod/v4";
import type { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";

// `convexRoutes<ActionCtx>()` is the equivalent of `HonoWithConvex<ActionCtx>`:
// every handler's `c.env` is typed as the Convex action context, so you can run
// queries and mutations directly from a route.
const route = convexRoutes<ActionCtx>();

const { preflight, headers } = cors({
  origin: "*",
  allowHeaders: ["Content-Type"],
});

const app = setup<Record<string, never>, ActionCtx>({
  // CORS headers on every response.
  onResponse: ({ request, response }) => headers(request, response),
  routes: [
    preflight(route),

    // GET /listMessages/:author -> messages by that author
    route.get("/listMessages/:author", {
      request: { params: z.object({ author: z.string().min(1) }) },
      resolve: async (c) => {
        if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
        const messages = await c.env.runQuery(api.messages.getByAuthor, {
          author: c.input.params.author,
        });
        return Response.json(messages);
      },
    }),

    // GET /messages -> latest messages
    route.get("/messages", {
      resolve: async (c) => Response.json(await c.env.runQuery(api.messages.list, {})),
    }),

    // POST /postMessage -> insert a message
    route.post("/postMessage", {
      request: {
        body: z.object({
          author: z.string().min(1),
          body: z.string().min(1).max(2000),
        }),
      },
      resolve: async (c) => {
        if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
        await c.env.runMutation(api.messages.send, c.input.body);
        return new Response("Sent message!");
      },
    }),

    // POST /sendAs -> insert a message authored by the authenticated user.
    // `c.env.auth` is the Convex auth context, so authentication is just a
    // call on the binding — no separate middleware wiring required.
    route.post("/sendAs", {
      request: { body: z.object({ body: z.string().min(1).max(2000) }) },
      resolve: async (c) => {
        const identity = await c.env.auth.getUserIdentity();
        if (!identity) return new Response("Unauthorized", { status: 401 });
        if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });

        const author = identity.name ?? identity.subject;
        await c.env.runMutation(api.messages.send, { author, body: c.input.body.body });
        return Response.json({ author, body: c.input.body.body }, { status: 201 });
      },
    }),
  ],
});

// The default export of `convex/http.ts` must be a Convex HttpRouter.
export default convexRouter(app);
