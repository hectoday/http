export interface Bookmark {
  id: string;
  url: string;
  title: string;
  tags: string[];
  userId: string;
  createdAt: string;
}

const bookmarks = new Map<string, Bookmark>();

export function createBookmark(input: {
  url: string;
  title: string;
  tags: string[];
  userId: string;
}): Bookmark {
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  bookmarks.set(bookmark.id, bookmark);
  return bookmark;
}

export function findById(id: string): Bookmark | undefined {
  return bookmarks.get(id);
}

export function findAllByUser(userId: string): Bookmark[] {
  return [...bookmarks.values()].filter((b) => b.userId === userId);
}

export function deleteById(id: string): boolean {
  return bookmarks.delete(id);
}
