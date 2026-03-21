# Changelog

## Unreleased

### Bug Fixes

- **query**: Treat malformed percent-encoding as raw text instead of throwing during query parsing, so bad query strings do not crash request handling.
- **setup**: Ensure `onResponse` still runs after `onRequest` and `onNotFound` errors are converted into error responses.
- **setup**: Merge `app.request(path, { query })` with query params already present in `path` instead of producing malformed URLs.

## 0.2.1

### Bug Fixes

- **cors**: Reflect request origin instead of `*` when `credentials: true` is used with a wildcard origin, matching the CORS specification. Only set `Access-Control-Allow-Credentials` header when the request origin is actually allowed.
- **query**: Decode `+` as space in query string keys and values, fixing form-encoded input like `?q=hello+world`.
- **setup**: Distinguish between missing and invalid request bodies so that optional body schemas (`z.object({...}).optional()`) accept empty requests instead of rejecting them as invalid JSON.

### Improvements

- **setup**: `app.request()` now accepts `string[]` values in the `query` option, producing repeated query keys (e.g., `{ tag: ["a", "b"] }` → `?tag=a&tag=b`).
