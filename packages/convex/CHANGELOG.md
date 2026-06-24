# Changelog

## 0.1.0

Initial release.

### Features

- **convexRouter**: Mount a `@hectoday/http` app onto a Convex `HttpRouter`. Forwards every request to `app.fetch(request, ctx)` with the Convex `ActionCtx` exposed as `c.env`, via a catch-all `pathPrefix: "/"` route per method. Accepts a `{ methods }` option to narrow the registered method set.
- **convexRoutes**: A typed route factory whose handlers receive `c.env` typed as the Convex action context — the equivalent of `HonoWithConvex`.
- **ConvexEnv**: Type helper resolving the Convex `ActionCtx` for a given `DataModel`.

### Dependencies

- Peer dependencies on `@hectoday/http` (`^0.3.0`) and `convex` (`>=1.16.0`).
