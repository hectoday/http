import { serve } from "srvx";
import { app } from "./app.ts";
import { log } from "./logger.ts";

const server = serve({
  port: 3000,
  fetch: app.fetch,
});

log.info({ url: server.url }, "server started");
