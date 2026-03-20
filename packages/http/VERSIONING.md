# Versioning Policy — @hectoday/http

This document describes the versioning policy for @hectoday/http.

## Semver

This package follows [Semantic Versioning 2.0.0](https://semver.org/).

- **Major** — Breaking changes to the public API. Removing or renaming exports, changing function signatures, altering default behavior, or dropping runtime support.
- **Minor** — New features, new exports, or new options that don't break existing usage.
- **Patch** — Bug fixes, documentation corrections, internal refactors with no observable behavior change.

## Public API surface

The public API is defined as everything exported from the package entry point. Internal modules, unexported types, and anything prefixed with `_` are not part of the public API and may change without a major bump.

## Companion packages

@hectoday/http is versioned independently from companion packages like @hectoday/openapi. Compatibility between packages is expressed through `peerDependencies`, not version alignment.

When a new major version of @hectoday/http introduces breaking changes, companion packages will release updates with an adjusted peer dependency range.

## Deprecation

Deprecated APIs are marked with `@deprecated` JSDoc tags and logged with a console warning at runtime where feasible. Deprecated APIs are removed no earlier than the next major version.

## Pre-1.0

While the package is below 1.0.0, minor versions may contain breaking changes. Patch versions remain non-breaking. The 0.x phase is used to iterate on the API before committing to stability guarantees.
