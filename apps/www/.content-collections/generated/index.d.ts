export interface Doc {
  title: string;
  slug: string;
  order: number;
  description: string;
  content: string;
  html: string;
}

export interface Changelog {
  content: string;
  html: string;
}

export declare const allDocs: Doc[];
export declare const allChangelogs: Changelog[];
