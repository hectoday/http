/**
 * Check if drafts should be shown based on environment and query parameters
 * @param url - The request URL
 * @param isDev - Whether running in development mode
 * @returns true if drafts should be shown
 */
export function shouldShowDrafts(url: URL, isDev: boolean): boolean {
  return isDev || url.searchParams.has("drafts");
}
