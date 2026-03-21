import { createFileRoute, Link } from "@tanstack/react-router";
import { allChangelogs } from "content-collections";
import { seoHead } from "../seo";

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  head: () =>
    seoHead({
      title: "Changelog",
      description: "Release history and changes for @hectoday/http.",
      path: "/changelog",
      markdownPath: "/changelog.md",
    }),
  loader: () => {
    const entry = allChangelogs[0];
    if (!entry) throw new Error("Changelog not found");
    return { html: entry.html };
  },
});

function ChangelogPage() {
  const { html } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        &larr; Home
      </Link>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
