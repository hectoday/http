import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { marked } from "marked";

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

const ROOT = resolve(import.meta.dirname, "../..");
const DOCS_DIR = resolve(ROOT, "../../packages/http/docs");
const CHANGELOG_PATH = resolve(ROOT, "../../packages/http/CHANGELOG.md");

function toDescription(content) {
  const descMatch = content.match(/^#[^\n]+\n+([^#`\n][^\n]{20,})/m);
  return descMatch ? descMatch[1].slice(0, 160).trim() : "";
}

function toHtml(content) {
  const html = marked.parse(content);
  return html.replace(/href="\.\/([^"]+)\.md"/g, 'href="/docs/$1"');
}

function createDoc(slug, content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const order = DOC_ORDER.indexOf(slug);

  return {
    title: titleMatch?.[1] ?? slug,
    slug,
    order: order === -1 ? 999 : order,
    description: toDescription(content),
    content,
    html: toHtml(content),
  };
}

function loadDocs() {
  const docFiles = readdirSync(DOCS_DIR).filter((file) => file.endsWith(".md"));

  return docFiles.map((file) => {
    const content = readFileSync(resolve(DOCS_DIR, file), "utf-8");
    return createDoc(file.replace(/\.md$/, ""), content);
  });
}

const changelogContent = readFileSync(CHANGELOG_PATH, "utf-8");

export const allDocs = loadDocs();

export const allChangelogs = [
  {
    content: changelogContent,
    html: toHtml(changelogContent),
  },
];
