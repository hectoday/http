/**
 * Build script for npm package.
 * Compiles TypeScript to JavaScript and generates type declarations.
 *
 * Run with: deno run -A scripts/build-npm.ts
 */

import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";

await emptyDir("./dist");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./dist",
  shims: {},
  test: false,
  skipNpmInstall: true,
  skipSourceOutput: true,
  declaration: "inline",
  declarationMap: false,
  scriptModule: false,
  package: {
    name: "@hectoday/http",
    version: Deno.args[0] || "0.0.0",
    description:
      "A minimal, explicit web framework built on Web Standards with deterministic control flow and no magic responses",
    type: "module",
    main: "./esm/mod.js",
    module: "./esm/mod.js",
    types: "./esm/mod.d.ts",
    exports: {
      ".": {
        types: "./esm/mod.d.ts",
        import: "./esm/mod.js",
      },
    },
    keywords: [
      "http",
      "web",
      "framework",
      "deno",
      "web-standards",
      "middleware",
      "router",
    ],
    repository: {
      type: "git",
      url: "https://github.com/hectoday/http.git",
      directory: "packages/http",
    },
    bugs: {
      url: "https://github.com/hectoday/http/issues",
    },
    homepage: "https://github.com/hectoday/http#readme",
    license: "MIT",
    author: "Hectoday",
    engines: {
      node: ">=18.0.0",
    },
  },
  postBuild() {
    // Copy additional files to dist
    Deno.copyFileSync("LICENSE", "dist/LICENSE");
    Deno.copyFileSync("README.md", "dist/README.md");
  },
});

console.log("Build complete! Output in ./dist");
