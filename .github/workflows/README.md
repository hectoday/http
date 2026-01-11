# GitHub Actions Workflows

## `ci.yml` - Continuous Integration

**Triggers:** Push to `main` or pull requests

**Runs:**

- Format check (`deno fmt --check`)
- Lint (`deno lint`)
- Tests (`deno test`)
- Type checks (example, benchmarks)
- JSR compatibility check

## `publish.yml` - Publish to JSR

**Trigger:** Manual only

**How to use:**

1. Actions tab → "Publish to JSR" → "Run workflow"
2. Optional: Enable "dry-run" to test

**What it does:**

1. Runs tests
2. If tests pass → publishes to JSR

## Local Testing

```bash
deno fmt --check && deno lint
cd packages/http && deno test --allow-net
deno publish --dry-run
```
