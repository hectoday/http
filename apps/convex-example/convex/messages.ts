import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: (ctx) => ctx.db.query("messages").order("desc").take(50),
});

export const getByAuthor = query({
  args: { author: v.string() },
  handler: (ctx, { author }) =>
    ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("author", author))
      .collect(),
});

export const send = mutation({
  args: { author: v.string(), body: v.string() },
  handler: (ctx, message) => ctx.db.insert("messages", message),
});
