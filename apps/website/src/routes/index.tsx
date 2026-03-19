import { createFileRoute, Link } from "@tanstack/react-router";
import { allDocs } from "content-collections";

const entry = allDocs.find((d) => d.slug === "index");
const docs = allDocs.filter((d) => d.slug !== "index");

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Hectoday HTTP</h1>
        <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
          A lightweight HTTP framework built on web standards.
        </p>
      </header>

      {entry && (
        <section className="prose mb-12">
          <div dangerouslySetInnerHTML={{ __html: entry.html }} />
        </section>
      )}

      <nav>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Documentation
        </h2>
        <ul className="space-y-1">
          {docs.map((doc) => (
            <li key={doc.slug}>
              <Link
                to="/docs/$slug"
                params={{ slug: doc.slug }}
                className="block rounded-lg px-3 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
