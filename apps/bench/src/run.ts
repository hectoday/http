import { execSync, spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4567;
const WRK_DURATION = "10s";
const WRK_THREADS = 4;
const WRK_CONNECTIONS = 128;
const WARMUP_DURATION = "3s";
const ITERATIONS = 5;

interface ServerConfig {
  name: string;
  file: string;
  runtime?: "deno";
}

const servers: ServerConfig[] = [
  { name: "bare (node:http)", file: "servers/bare-node.ts" },
  { name: "@hectoday/http", file: "servers/hectoday-http.ts" },
  { name: "hono", file: "servers/hono.ts" },
  { name: "fastify", file: "servers/fastify.ts" },
  { name: "express", file: "servers/express.ts" },
  { name: "bare (Deno.serve)", file: "servers/bare-deno.ts", runtime: "deno" },
  { name: "@hectoday/http (Deno)", file: "servers/hectoday-deno.ts", runtime: "deno" },
];

const routes = [
  { name: "GET /", label: "text", path: "/" },
  { name: "GET /json", label: "json", path: "/json" },
  { name: "GET /user/:id", label: "param+zod", path: "/user/42" },
];

interface RunResult {
  reqPerSec: number;
  latencyAvg: string;
}

interface BenchResult {
  server: string;
  route: string;
  runs: RunResult[];
  mean: number;
  stddev: number;
}

function parseWrkOutput(raw: string): RunResult {
  const rpsMatch = raw.match(/Requests\/sec:\s+([\d.]+)/);
  const latMatch = raw.match(/Latency\s+([\d.]+\w+)/);
  return {
    reqPerSec: rpsMatch ? parseFloat(rpsMatch[1]) : 0,
    latencyAvg: latMatch ? latMatch[1] : "N/A",
  };
}

function startServer(server: ServerConfig): ChildProcess {
  const cwd = import.meta.dirname + "/..";
  if (server.runtime === "deno") {
    return spawn(
      "deno",
      ["run", "--allow-net", "--allow-read", "--allow-env", `src/${server.file}`, String(PORT)],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  }
  return spawn("npx", ["tsx", `src/${server.file}`, String(PORT)], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForServer(maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      await res.text();
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`Server on port ${PORT} did not start`);
}

function runWrk(path: string, duration: string): string {
  return execSync(
    `wrk -t${WRK_THREADS} -c${WRK_CONNECTIONS} -d${duration} http://127.0.0.1:${PORT}${path}`,
    { encoding: "utf-8" },
  );
}

function warmup(): void {
  for (const r of routes) {
    runWrk(r.path, WARMUP_DURATION);
  }
}

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stddev(nums: number[]): number {
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, n) => sum + (n - avg) ** 2, 0) / (nums.length - 1));
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

async function main() {
  console.log("=".repeat(78));
  console.log("  @hectoday/http benchmark");
  console.log(
    `  wrk: ${WRK_THREADS} threads, ${WRK_CONNECTIONS} connections, ${WRK_DURATION}/iteration`,
  );
  console.log(`  ${ITERATIONS} iterations per endpoint, ${WARMUP_DURATION} warmup`);
  console.log(`  validation: zod on /user/:id for all frameworks (except bare)`);
  console.log("=".repeat(78));

  const results: BenchResult[] = [];

  for (const server of servers) {
    console.log(`\n--- ${server.name} ---\n`);

    const proc = startServer(server);

    try {
      await waitForServer();

      process.stdout.write("  warming up ... ");
      warmup();
      console.log("done");

      for (const routeInfo of routes) {
        const runs: RunResult[] = [];

        process.stdout.write(`  ${routeInfo.name} (${routeInfo.label})`);

        for (let i = 0; i < ITERATIONS; i++) {
          const raw = runWrk(routeInfo.path, WRK_DURATION);
          const parsed = parseWrkOutput(raw);
          runs.push(parsed);
          process.stdout.write(` ${fmt(parsed.reqPerSec)}`);
        }

        const rpsValues = runs.map((r) => r.reqPerSec);
        const m = mean(rpsValues);
        const sd = stddev(rpsValues);

        results.push({
          server: server.name,
          route: routeInfo.name,
          runs,
          mean: m,
          stddev: sd,
        });

        console.log(` → ${fmt(m)} ± ${fmt(sd)} req/s`);
      }
    } finally {
      proc.kill("SIGTERM");
      await sleep(500);
    }
  }

  // Summary table
  console.log("\n" + "=".repeat(78));
  console.log("  SUMMARY — requests/sec (mean ± stddev, n=" + ITERATIONS + ")\n");

  const serverNames = servers.map((s) => s.name);
  const colW = 22;
  const nameW = 22;

  // Header
  process.stdout.write("  " + "Route".padEnd(nameW));
  for (const s of serverNames) process.stdout.write(s.padStart(colW));
  console.log();
  console.log("  " + "-".repeat(nameW + colW * serverNames.length));

  // Rows
  for (const routeInfo of routes) {
    process.stdout.write("  " + `${routeInfo.name} (${routeInfo.label})`.padEnd(nameW));
    for (const serverName of serverNames) {
      const r = results.find((x) => x.server === serverName && x.route === routeInfo.name);
      const val = r ? `${fmt(r.mean)} ±${fmt(r.stddev)}` : "N/A";
      process.stdout.write(val.padStart(colW));
    }
    console.log();
  }

  console.log("\n" + "=".repeat(78));

  // Notes
  console.log("\n  Notes:");
  console.log("  - Each framework uses its native HTTP server");
  console.log("  - bare (node:http) has no validation (baseline ceiling)");
  console.log("  - /user/:id includes zod .safeParse() in all frameworks");
  console.log("  - Node.js " + process.version);
  try {
    const denoVer = execSync("deno --version", { encoding: "utf-8" }).split("\n")[0];
    console.log("  - " + denoVer);
  } catch {}
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
