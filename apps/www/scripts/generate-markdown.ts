/**
 * Generates static .md files and llms.txt into public/ for LLM-friendly access.
 * Run: npx tsx scripts/generate-markdown.ts
 */

import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS_DIR = resolve(ROOT, "../../packages/http/docs");
const CHANGELOG_PATH = resolve(ROOT, "../../packages/http/CHANGELOG.md");
const PUBLIC = resolve(ROOT, "public");

const DOC_ORDER = [
  "installation",
  "your-first-server",
  "routes",
  "validation",
  "auth",
  "hooks",
  "project-structure",
  "testing",
  "cors",
  "openapi",
  "client-types",
  "versioning",
  "serving",
  "api-reference",
  "diagrams",
];

// Copy doc markdown files to public/docs/
mkdirSync(resolve(PUBLIC, "docs"), { recursive: true });

const docFiles = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
for (const file of docFiles) {
  cpSync(resolve(DOCS_DIR, file), resolve(PUBLIC, "docs", file));
}

// Copy index.md to public root
cpSync(resolve(DOCS_DIR, "index.md"), resolve(PUBLIC, "index.md"));

// Copy changelog
cpSync(CHANGELOG_PATH, resolve(PUBLIC, "changelog.md"));

// Generate llms.txt
const slugs = docFiles.filter((f) => f !== "index.md").map((f) => f.replace(/\.md$/, ""));

const ordered = slugs
  .filter((s) => DOC_ORDER.includes(s))
  .sort((a, b) => DOC_ORDER.indexOf(a) - DOC_ORDER.indexOf(b));

const unordered = slugs.filter((s) => !DOC_ORDER.includes(s)).sort();

function titleFromSlug(slug: string): string {
  const content = readFileSync(resolve(DOCS_DIR, `${slug}.md`), "utf-8");
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1] ?? slug;
}

const llmsTxt = [
  "# @hectoday/http",
  "",
  "> A lightweight HTTP framework built on web standards.",
  "",
  "## Docs",
  "",
  "- [Home](https://http.hectoday.com/index.md)",
  ...[...ordered, ...unordered].map(
    (s) => `- [${titleFromSlug(s)}](https://http.hectoday.com/docs/${s}.md)`,
  ),
  "",
  "## Other",
  "",
  "- [Changelog](https://http.hectoday.com/changelog.md)",
  "",
].join("\n");

writeFileSync(resolve(PUBLIC, "llms.txt"), llmsTxt);

console.log(`Generated ${docFiles.length} doc files, changelog.md, index.md, and llms.txt`);
