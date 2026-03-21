# Changelog

## Unreleased

### Bug Fixes

- **paths**: Skip wildcard route patterns containing `**` when generating OpenAPI documents, avoiding invalid path entries for catch-all routes.
- **responses**: Omit OpenAPI `content` entries for response status codes that cannot include a body (`1xx`, `204`, `205`, `304`).
- **types**: Fix `securitySchemes` typings so valid `oauth2` and `openIdConnect` configurations type-check correctly.
