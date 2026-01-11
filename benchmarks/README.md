# @hectoday/http Benchmarks

Simple benchmarks for @hectoday/http using [wrk](https://github.com/wg/wrk).

## Requirements

Install wrk:

```bash
# macOS
brew install wrk

# Linux
apt-get install wrk
```

## Run Benchmarks

```bash
./run.sh
```

Or from the root directory:

```bash
deno task bench
```

## Configuration

Customize via environment variables:

```bash
PORT=3000 DURATION=30s ./run.sh
```

Available options:
- `PORT` - Server port (default: 8000)
- `DURATION` - Benchmark duration (default: 10s)

## Endpoints

The benchmark server tests:
- `GET /` - Plain text response
- `GET /json` - JSON response
- `GET /users/:id` - Route with parameters
