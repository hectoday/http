# Publishing Guide

## Quick Steps

1. **Update version** in `packages/http/deno.jsonc`
2. **Commit and push** changes
3. **GitHub Actions** → "Publish to JSR" → "Run workflow"
4. Done

## GitHub Actions (Recommended)

Go to Actions tab → "Publish to JSR" → Click "Run workflow"

- Select branch (usually `main`)
- Optional: Enable "dry-run" to test first
- Tests must pass before publishing

## Local Publishing

```bash
cd packages/http
deno publish --dry-run  # Test first
deno publish            # Publish
```

## Before Publishing

Update version in `packages/http/deno.jsonc`:
```jsonc
{
  "version": "0.2.0"  // Increment this
}
```

Verify locally:
```bash
deno fmt && deno lint
cd packages/http && deno test --allow-net
deno publish --dry-run
```

## After Publishing

- Check https://jsr.io/@hectoday/http
- Tag release: `git tag v0.2.0 && git push --tags`

## Rollback

Within 72 hours:
```bash
cd packages/http
deno publish --undo
```
