import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import Fuse from "fuse.js";

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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Filter docs based on draft status
  const visibleDocs = useMemo(
    () => docs.filter((doc) => !doc.draft || isDev),
    [docs, isDev],
  );

  // Separate into main docs and helpers
  const mainDocs = useMemo(
    () => visibleDocs.filter((doc) => !doc.id.startsWith("helpers/")),
    [visibleDocs],
  );

  const helperDocs = useMemo(
    () => visibleDocs.filter((doc) => doc.id.startsWith("helpers/")),
    [visibleDocs],
  );

  // Create Fuse instances for fuzzy search
  const mainFuse = useMemo(
    () =>
      new Fuse(mainDocs, {
        keys: ["title", "description"],
        threshold: 0.3,
        includeScore: true,
      }),
    [mainDocs],
  );

  const helperFuse = useMemo(
    () =>
      new Fuse(helperDocs, {
        keys: ["title", "description"],
        threshold: 0.3,
        includeScore: true,
      }),
    [helperDocs],
  );

  // Search results using Fuse.js
  const mainResults = useMemo(() => {
    if (!search) return mainDocs;
    return mainFuse.search(search).map((result) => result.item);
  }, [search, mainDocs, mainFuse]);

  const helperResults = useMemo(() => {
    if (!search) return helperDocs;
    return helperFuse.search(search).map((result) => result.item);
  }, [search, helperDocs, helperFuse]);

  // Keyboard shortcut to open/close
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

  // Scroll lock when open
  useEffect(() => {
    if (!open) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    dialog.addEventListener("keydown", handleTabKey);
    return () => dialog.removeEventListener("keydown", handleTabKey);
  }, [open]);

  const handleSelect = (docId: string) => {
    setOpen(false);
    setSearch("");
    window.location.href = `/docs/${docId}`;
  };

  const handleClose = () => {
    setOpen(false);
    setSearch("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10%] px-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command Menu"
        className="w-full max-w-2xl min-w-[600px]"
      >
        <Command
          className="relative w-full bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
          label="Command Menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              handleClose();
            }
          }}
          shouldFilter={false}
        >
          <div className="flex items-center border-b border-gray-200 px-4">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
          <Command.List className="h-96 overflow-y-auto p-2">
            {mainResults.length === 0 && helperResults.length === 0
              ? (
                <Command.Empty className="py-6 text-center text-sm text-gray-500">
                  No results found.
                </Command.Empty>
              )
              : (
                <>
                  {mainResults.length > 0 && (
                    <Command.Group
                      heading="Documentation"
                      className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                    >
                      {mainResults.map((doc) => (
                        <Command.Item
                          key={doc.id}
                          value={doc.id}
                          onSelect={() => handleSelect(doc.id)}
                          className="flex flex-col px-3 py-2.5 rounded cursor-pointer data-[selected=true]:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base font-medium">
                              {doc.title}
                            </span>
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
                  )}

                  {helperResults.length > 0 && (
                    <Command.Group
                      heading="Helpers"
                      className="mt-4 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                    >
                      {helperResults.map((doc) => (
                        <Command.Item
                          key={doc.id}
                          value={doc.id}
                          onSelect={() => handleSelect(doc.id)}
                          className="flex flex-col px-3 py-2.5 rounded cursor-pointer data-[selected=true]:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base font-medium">
                              {doc.title}
                            </span>
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
                  )}
                </>
              )}
          </Command.List>
          <div className="border-t border-[rgb(209,217,224)] px-3 py-2 text-xs text-gray-500 flex items-center justify-between">
            <div className="flex gap-3">
              <span>
                <kbd className="px-1 py-0.5 bg-gray-50 rounded text-xs text-gray-600">
                  ↑↓
                </kbd>{" "}
                Navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-50 rounded text-xs text-gray-600">
                  ↵
                </kbd>{" "}
                Select
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-50 rounded text-xs text-gray-600">
                  Esc
                </kbd>{" "}
                Close
              </span>
            </div>
            <span className="text-gray-400">
              <kbd className="px-1 py-0.5 bg-gray-50 rounded text-xs text-gray-600">
                ⌘K
              </kbd>
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
