# Versioning Policy — @hectoday/convex

This document describes the versioning policy for @hectoday/convex.

## Semver

This package follows [Semantic Versioning 2.0.0](https://semver.org/).

- **Major** — Breaking changes to the public API, or a new major peer dependency requirement on @hectoday/http or convex.
- **Minor** — New features, new exports, or new options that don't break existing usage. May include widening the @hectoday/http or convex peer dependency range.
- **Patch** — Bug fixes, documentation corrections, internal refactors with no observable behavior change.

## Public API surface

The public API is defined as everything exported from the package entry point. Internal modules, unexported types, and anything prefixed with `_` are not part of the public API and may change without a major bump.

## Relationship to @hectoday/http and convex

This package declares both @hectoday/http and convex as peer dependencies. The peer dependency ranges specify which versions are supported.

```json
{
  "peerDependencies": {
    "@hectoday/http": "^0.3.0",
    "convex": ">=1.16.0"
  }
}
```

When @hectoday/http or convex releases a new major version:

1. A new release of @hectoday/convex will follow with an updated peer dependency range.
2. If updating a peer dependency requires changes to @hectoday/convex's own public API, that release is also a major. Otherwise it is a minor.

## Deprecation

Deprecated APIs are marked with `@deprecated` JSDoc tags and logged with a console warning at runtime where feasible. Deprecated APIs are removed no earlier than the next major version.

## Pre-1.0

While the package is below 1.0.0, minor versions may contain breaking changes. Patch versions remain non-breaking. The 0.x phase is used to iterate on the API before committing to stability guarantees.
