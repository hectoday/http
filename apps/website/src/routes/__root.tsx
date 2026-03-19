import type { ReactNode } from "react";
import { Link, Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import css from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hectoday HTTP" },
    ],
    links: [{ rel: "stylesheet", href: css }],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">Page not found.</p>
      <Link
        to="/"
        className="mt-4 inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400"
      >
        &larr; Back to docs
      </Link>
    </main>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <HeadContent />
      </head>
      <body className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
