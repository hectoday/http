export const SITE_NAME = "@hectoday/http";
export const SITE_DESCRIPTION =
  "A lightweight HTTP framework built on web standards. Type-safe routes, Zod validation, and zero lock-in.";
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? "https://http.hectoday.com";

interface SeoHeadOptions {
  title?: string;
  description?: string;
  path?: string;
  type?: "website" | "article";
  markdownPath?: string;
}

export function seoHead({
  title,
  description,
  path,
  type = "website",
  markdownPath,
}: SeoHeadOptions = {}) {
  const fullTitle = title ? `${title} - ${SITE_NAME}` : SITE_NAME;
  const desc = description ?? SITE_DESCRIPTION;
  const url = path ? `${SITE_URL}${path}` : SITE_URL;

  const links: { rel: string; href: string; type?: string }[] = [{ rel: "canonical", href: url }];
  if (markdownPath) {
    links.push({ rel: "alternate", type: "text/markdown", href: markdownPath });
  }

  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: desc },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { property: "og:type", content: type },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: desc },
    ],
    links,
  };
}
