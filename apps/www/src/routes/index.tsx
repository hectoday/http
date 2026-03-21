import { createFileRoute, Link } from "@tanstack/react-router";
import { allDocs } from "content-collections";

const ordered = allDocs.filter((d) => d.order < 999).sort((a, b) => a.order - b.order);

export const Route = createFileRoute("/")({
  component: HomePage,
  loader: () => {
    const doc = allDocs.find((d) => d.slug === "index");
    if (!doc) throw new Error("index doc not found");
    const next = ordered[0] ?? null;
    return { doc, next };
  },
});

function HomePage() {
  const { doc, next } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: doc.html }} />
      <nav className="mt-16 flex items-center justify-between border-t pt-6 dark:border-neutral-800">
        <Link to="/changelog" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Changelog
        </Link>
        {next ? (
          <Link
            to="/docs/$slug"
            params={{ slug: next.slug }}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {next.title} &rarr;
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
