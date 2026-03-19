export function parseQuery(search: string): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[]> = Object.create(null);
  if (!search || search === "?") return result;
  const qs = search.startsWith("?") ? search.slice(1) : search;

  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    const key = decodeURIComponent(eqIdx === -1 ? pair : pair.slice(0, eqIdx));
    const value = eqIdx === -1 ? "" : decodeURIComponent(pair.slice(eqIdx + 1));

    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }

  return result;
}
