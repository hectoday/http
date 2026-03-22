# Changelog

## 0.2.0

### Bug Fixes

- **paths**: Skip wildcard routes containing `**` in OpenAPI document generation.
- **responses**: Omit `content` for status codes that cannot have a body (`1xx`, `204`, `205`, `304`).
- **types**: Fix `securitySchemes` typings for `oauth2` and `openIdConnect` schemes.

### Dependencies

- Upgrade `zod-openapi` to `5.x`.
- Migrate to Zod v4 (`zod/v4`). Minimum peer dependency is now `^3.25.0`.
