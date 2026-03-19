import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, routes, type Bookmark } from "../api/client.ts";
import { Spinner } from "../components/spinner.tsx";
import { useSession } from "../hooks/use-session.ts";
import { bookmarksOptions, tagsOptions } from "../api/queries.ts";
import { cn, buttonVariant, btn, inputClass, card } from "../styles.ts";
import { DashboardSkeleton, BookmarkSkeleton, TagsSkeleton } from "../components/skeleton.tsx";

const LIMIT = 20;

export function DashboardPage() {
  const { token, user, logout } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeTag, setActiveTag] = useState<string | undefined>();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bookmarksQuery = useQuery({
    ...bookmarksOptions(page, LIMIT, activeTag),
    enabled: !!user,
  });

  const tagsQuery = useQuery({
    ...tagsOptions(),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { url: string; title: string; tags: string[] }) => {
      const res = await api.createBookmark(data.url, data.title, data.tags, token!);
      if (!res.ok) {
        if (res.status === 401) {
          logout();
          void navigate({ to: "/login" });
        }
        throw new Error(
          typeof res.error.error === "string" ? res.error.error : JSON.stringify(res.error.error),
        );
      }
      return res.data;
    },
    onSuccess: () => {
      setUrl("");
      setTitle("");
      setTagsInput("");
      setPage(1);
      void queryClient.invalidateQueries({ queryKey: [routes.bookmarks.pattern] });
      void queryClient.invalidateQueries({ queryKey: [routes.tags.pattern] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.deleteBookmark(id, token!);
      if (!res.ok) {
        if (res.status === 401) {
          logout();
          void navigate({ to: "/login" });
        }
        throw new Error(typeof res.error.error === "string" ? res.error.error : "Failed to delete");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [routes.bookmarks.pattern] });
      void queryClient.invalidateQueries({ queryKey: [routes.tags.pattern] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim() || !token) return;
    setError(null);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    createMutation.mutate({ url: url.trim(), title: title.trim(), tags });
  };

  const handleTagClick = (tag: string) => {
    setActiveTag((prev) => (prev === tag ? undefined : tag));
    setPage(1);
  };

  const handleLogout = () => {
    logout();
    void navigate({ to: "/login" });
  };

  // Wait for user session to load
  if (!user) {
    return <DashboardSkeleton />;
  }

  const bookmarks: Bookmark[] = bookmarksQuery.data?.bookmarks ?? [];
  const total = bookmarksQuery.data?.total ?? 0;
  const allTags = tagsQuery.data ?? {};
  const tagEntries = Object.entries(allTags).sort((a, b) => b[1] - a[1]);
  const displayError = error || (bookmarksQuery.error ? bookmarksQuery.error.message : null);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10 font-sans antialiased">
      {/* Header */}
      <header className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 shadow-sm shadow-blue-600/25">
            <svg
              className="size-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Bookmarks</h1>
            <p className="text-[0.8rem] text-zinc-400">
              Powered by{" "}
              <code className="rounded-md border border-zinc-100 bg-zinc-50 px-1.5 py-0.5 font-mono text-[0.7rem] text-zinc-500">
                @hectoday/http
              </code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user.role === "admin" && (
            <Link
              to="/admin"
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-600 cursor-pointer"
              title="Admin"
            >
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
                />
              </svg>
            </Link>
          )}
          <div className="text-right">
            <p className="text-sm font-medium text-zinc-900">{user.name}</p>
            <p className="text-[0.7rem] text-zinc-400">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 cursor-pointer"
            title="Sign out"
          >
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Error */}
      {displayError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5">
          <svg
            className="mt-0.5 size-4 shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <p className="text-sm text-red-700">{displayError}</p>
        </div>
      )}

      {/* Create form */}
      <section className={card}>
        <div className="mb-4 flex items-center gap-2">
          <svg
            className="size-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <h2 className="text-sm font-semibold text-zinc-900">Add bookmark</h2>
        </div>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className={cn(inputClass, "flex-[2]")}
            />
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={cn(inputClass, "flex-[1]")}
            />
          </div>
          <div className="flex gap-3">
            <input
              placeholder="Tags (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className={cn(inputClass, "flex-1")}
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className={cn(btn, buttonVariant("primary"), "shrink-0 px-5")}
            >
              {createMutation.isPending ? <Spinner /> : "Save"}
            </button>
          </div>
        </form>
      </section>

      {/* Tags */}
      {tagsQuery.isLoading && <TagsSkeleton />}
      {tagEntries.length > 0 && (
        <section className="flex flex-wrap items-center gap-1.5">
          {tagEntries.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 cursor-pointer",
                activeTag === tag
                  ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                  : "border-zinc-200/80 bg-white text-zinc-500 shadow-sm hover:border-zinc-300 hover:text-zinc-700",
              )}
            >
              {tag}
              <span className="font-mono text-[0.6rem] opacity-60">{count}</span>
            </button>
          ))}
          {activeTag && (
            <button
              onClick={() => {
                setActiveTag(undefined);
                setPage(1);
              }}
              className={cn(btn, buttonVariant("ghost"), "rounded-full text-xs px-3 py-1")}
            >
              Clear
            </button>
          )}
        </section>
      )}

      {/* Bookmarks list */}
      <section className={card}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="size-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-zinc-900">
              {activeTag ? `Tagged "${activeTag}"` : "All bookmarks"}
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[0.65rem] font-medium text-zinc-500">
              {total}
            </span>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: [routes.bookmarks.pattern] })}
            disabled={bookmarksQuery.isFetching}
            className={cn(btn, buttonVariant("default"), "text-xs px-3 py-1.5")}
          >
            {bookmarksQuery.isFetching ? <Spinner className="size-3.5" /> : "Refresh"}
          </button>
        </div>

        {bookmarksQuery.isLoading && (
          <div className="flex flex-col divide-y divide-zinc-100">
            <BookmarkSkeleton />
            <BookmarkSkeleton />
            <BookmarkSkeleton />
          </div>
        )}

        {bookmarks.length === 0 && !bookmarksQuery.isLoading && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <svg
              className="size-8 text-zinc-200"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
              />
            </svg>
            <p className="text-sm text-zinc-400">No bookmarks yet</p>
            <p className="text-xs text-zinc-300">Save a URL above to get started.</p>
          </div>
        )}

        <ul className="flex flex-col divide-y divide-zinc-100">
          {bookmarks.map((bm) => (
            <li
              key={bm.id}
              className="group flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <svg
                      className="size-3 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-1.06 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                      />
                    </svg>
                  </div>
                  <a
                    href={bm.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-zinc-900 transition-colors hover:text-blue-600"
                  >
                    {bm.title}
                  </a>
                </div>
                <span className="ml-8 truncate font-mono text-[0.65rem] text-zinc-400">
                  {bm.url}
                </span>
                <div className="ml-8 flex flex-wrap items-center gap-1.5">
                  {bm.tags.map((t) => (
                    <span
                      key={t}
                      onClick={() => handleTagClick(t)}
                      className="cursor-pointer rounded-md bg-blue-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-blue-600 transition-colors hover:bg-blue-100"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="font-mono text-[0.6rem] text-zinc-300">
                    {bm.createdBy} · {new Date(bm.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(bm.id)}
                className="shrink-0 rounded-lg p-1.5 text-zinc-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 cursor-pointer"
              >
                <svg
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {total > LIMIT && (
          <div className="mt-4 flex items-center justify-center gap-4 border-t border-zinc-100 pt-4 text-sm text-zinc-400">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={cn(btn, buttonVariant("default"), "text-xs")}
            >
              Previous
            </button>
            <span className="text-xs">
              Page {page} of {Math.ceil(total / LIMIT)}
            </span>
            <button
              disabled={page >= Math.ceil(total / LIMIT)}
              onClick={() => setPage((p) => p + 1)}
              className={cn(btn, buttonVariant("default"), "text-xs")}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
