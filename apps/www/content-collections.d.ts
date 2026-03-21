// Fallback type declarations for content-collections.
// At dev/build time the Vite plugin generates full types into
// .content-collections/generated. This file is only used when that
// directory does not exist (e.g. during standalone type-checking in CI).

interface Doc {
  title: string;
  slug: string;
  order: number;
  description: string;
  html: string;
}

interface Changelog {
  html: string;
}

export declare const allChangelogs: Changelog[];
export declare const allDocs: Doc[];
