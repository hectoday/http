import { defineConfig } from "vite-plus";
import contentCollections from "@content-collections/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    watch: {
      ignored: ["**/.content-collections/**", "**/routeTree.gen.ts"],
    },
  },
  plugins: [
    contentCollections(),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  test: {
    environment: "jsdom",
    server: {
      deps: {
        inline: [/react/, /react-dom/],
      },
    },
  },
});

export default config;
