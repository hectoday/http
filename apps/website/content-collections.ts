import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import { z } from "zod";

const docs = defineCollection({
  name: "docs",
  directory: "../../packages/http/docs",
  include: "**/*.md",
  schema: z.object({
    content: z.string(),
  }),
  transform: async (doc, ctx) => {
    const html = await compileMarkdown(ctx, doc);
    const titleMatch = doc.content.match(/^#\s+(.+)$/m);
    return {
      title: titleMatch?.[1] ?? doc._meta.fileName.replace(/\.md$/, ""),
      slug: doc._meta.path,
      html,
    };
  },
});

export default defineConfig({
  content: [docs],
});
