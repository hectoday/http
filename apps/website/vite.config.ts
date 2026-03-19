import contentCollections from "@content-collections/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // @ts-expect-error -- vite@7 supports this natively, vite-plus types lag behind
    tsconfigPaths: true,
  },
  plugins: [contentCollections(), tailwindcss(), tanstackStart(), react()],
});
