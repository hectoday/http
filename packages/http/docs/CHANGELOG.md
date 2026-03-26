# Changelog

## 0.3.1

### Bug Fixes

- **setup**: Wrap input extraction and validation in error handling so unexpected failures route through `onError` instead of crashing the server with an unhandled exception (#40).

## 0.3.0

### Bug Fixes

- **cors**: Only emit CORS headers when the request origin is allowed.
- **cors**: Reflect requested headers in preflight responses when `allowHeaders` is not configured.
- **query**: Handle malformed percent-encoding gracefully instead of throwing.
- **setup**: Ensure `onResponse` runs after `onRequest` and `onNotFound` errors.
- **setup**: Merge `app.request()` query option with query params already in the path.
- **cors**: Reflect request origin when `credentials: true` is used with a wildcard origin.
- **query**: Decode `+` as space in query string keys and values.
- **setup**: Accept empty request bodies for optional body schemas.

### Improvements

- **setup**: `app.request()` now accepts `string[]` values in the `query` option.

### Dependencies

- Upgrade `rou3` to `0.8.x`.
- Migrate to Zod v4 (`zod/v4`). Minimum peer dependency is now `^3.25.0`.
