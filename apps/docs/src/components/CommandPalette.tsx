import { useEffect, useState } from "react";
import { Command } from "cmdk";

interface DocItem {
  id: string;
  title: string;
  description?: string;
  draft: boolean;
}

interface CommandPaletteProps {
  docs: DocItem[];
  isDev: boolean;
}

export default function CommandPalette({ docs, isDev }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (docId: string) => {
    setOpen(false);
    setSearch("");
    window.location.href = `/docs/${docId}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <Command
        className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden"
        label="Command Menu"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      >
        <div className="flex items-center border-b border-gray-200 px-4">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            className="w-full px-4 py-4 text-base outline-none"
            placeholder="Search documentation..."
            autoFocus
          />
        </div>
        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-gray-500">
            No results found.
          </Command.Empty>

          <Command.Group heading="Documentation" className="mb-2">
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Documentation
            </div>
            {docs
              .filter((doc) => !doc.id.startsWith("helpers/"))
              .filter((doc) => !doc.draft || isDev)
              .map((doc) => (
                <Command.Item
                  key={doc.id}
                  value={`${doc.title} ${doc.description || ""}`}
                  onSelect={() => handleSelect(doc.id)}
                  className="flex flex-col px-4 py-3 rounded-md cursor-pointer data-[selected=true]:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{doc.title}</span>
                    {doc.draft && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                  {doc.description && (
                    <span className="text-sm text-gray-500 mt-0.5">
                      {doc.description}
                    </span>
                  )}
                </Command.Item>
              ))}
          </Command.Group>

          <Command.Group heading="Helpers" className="mt-4">
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Helpers
            </div>
            {docs
              .filter((doc) => doc.id.startsWith("helpers/"))
              .filter((doc) => !doc.draft || isDev)
              .map((doc) => (
                <Command.Item
                  key={doc.id}
                  value={`${doc.title} ${doc.description || ""}`}
                  onSelect={() => handleSelect(doc.id)}
                  className="flex flex-col px-4 py-3 rounded-md cursor-pointer data-[selected=true]:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{doc.title}</span>
                    {doc.draft && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                  {doc.description && (
                    <span className="text-sm text-gray-500 mt-0.5">
                      {doc.description}
                    </span>
                  )}
                </Command.Item>
              ))}
          </Command.Group>
        </Command.List>
        <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                ↵
              </kbd>{" "}
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                Esc
              </kbd>{" "}
              Close
            </span>
          </div>
          <span className="text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
              ⌘K
            </kbd>
          </span>
        </div>
      </Command>
    </div>
  );
}
