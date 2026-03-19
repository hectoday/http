import { authHandlers } from "./handlers/auth.ts";
import { bookmarkHandlers } from "./handlers/bookmarks.ts";
import { adminHandlers } from "./handlers/admin.ts";

export const handlers = [...authHandlers, ...bookmarkHandlers, ...adminHandlers];
