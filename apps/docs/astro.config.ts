// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import deno from "@deno/astro-adapter";
import type { ThemeRegistration } from "shiki";
import hectodayTheme from "./src/styles/hectoday.shiki.json";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: deno(),
  vite: {
    server: {
      fs: {
        allow: ["../.."],
      },
    },
    resolve: {
      alias: {
        "~": "/src",
      },
    },
    plugins: [tailwindcss()],
  },

  integrations: [react()],

  markdown: {
    shikiConfig: {
      theme: hectodayTheme as ThemeRegistration,
    },
  },
});
