# Publishing Guide

## Quick Steps

1. **GitHub Actions** → "Release" → "Run workflow"
2. **Enter version** (e.g., `0.2.0`)
3. **Select registries** (JSR, npm, or both)
4. **Optional**: Enable "dry-run" to test first
5. Done - automatic version update, git tag, and publish

## GitHub Actions

### Publishing a Release

Go to Actions tab → "Release" → Click "Run workflow"

**Parameters:**
- **Version**: Version to publish (e.g., `0.2.0`)
- **Publish to JSR**: ✓ Enabled by default
- **Publish to npm**: ✓ Enabled by default
- **Dry-run**: Test without actually publishing

**What happens:**
1. Runs tests to ensure everything works
2. Updates version in `deno.jsonc` and `package.json`
3. Commits version bump and creates git tag
4. Publishes to selected registries (JSR and/or npm)

### Publishing to Specific Registries

You can choose to publish to:
- **Both JSR and npm** (default)
- **JSR only** - Uncheck "Publish to npm"
- **npm only** - Uncheck "Publish to JSR"

## Documentation Deployment

Documentation automatically deploys when:
- Changes are pushed to `main` branch
- Files in `apps/docs/**` are modified

You can also manually trigger deployment:
- Go to Actions → "Deploy Docs" → "Run workflow"

## Local Publishing

### JSR

```bash
cd packages/http
deno publish --dry-run  # Test first
deno publish            # Publish
```

### npm

```bash
cd packages/http
npm publish --dry-run --access public  # Test first
npm publish --access public            # Publish
```

## Before Publishing

**Important:** The GitHub Actions workflow automatically updates versions, so you don't need to manually edit version files. However, if publishing locally:

Update version in both files:

**packages/http/deno.jsonc:**
```jsonc
{
  "version": "0.2.0" // Increment this
}
```

**packages/http/package.json:**
```json
{
  "version": "0.2.0" // Increment this
}
```

Verify locally:

```bash
deno fmt && deno lint
cd packages/http && deno test --allow-net
deno publish --dry-run
npm publish --dry-run --access public
```

## After Publishing

- **JSR**: Check https://jsr.io/@hectoday/http
- **npm**: Check https://www.npmjs.com/package/@hectoday/http
- Git tag is automatically created (e.g., `v0.2.0`)

## Prerequisites

### For npm Publishing

You need an npm token with publish permissions:

1. Create token at https://www.npmjs.com/settings/tokens
2. Add as repository secret: `NPM_TOKEN`
3. Go to: Settings → Secrets and variables → Actions → New repository secret

### For JSR Publishing

No additional setup needed - uses GitHub's OIDC token.

### For Docs Deployment

Configure Deno Deploy project:
1. Create project at https://deno.com/deploy
2. Name it `hectoday-http-docs` (or update workflow)
3. Link GitHub repository
4. Set up deployment token if needed

## Rollback

### JSR
Within 72 hours:
```bash
cd packages/http
deno publish --undo
```

### npm
You cannot unpublish after 72 hours. Instead, publish a new version:
```bash
npm deprecate @hectoday/http@0.2.0 "Use version X.X.X instead"
```

## Troubleshooting

### npm publish fails with authentication error
- Verify `NPM_TOKEN` secret is set correctly
- Ensure token has publish permissions
- Check token hasn't expired

### JSR publish fails
- Ensure slow types check passes: `deno publish --dry-run`
- Check version number is higher than previous
- Verify all exports are valid

### Docs deployment fails
- Check Deno Deploy project name matches workflow
- Verify build succeeds locally: `cd apps/docs && deno task build`
- Check deployment logs in Deno Deploy dashboard

### Version already exists
- You cannot republish the same version
- Increment version number and try again
- For npm: versions are immutable once published
