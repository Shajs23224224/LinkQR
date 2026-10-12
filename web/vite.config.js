import { defineConfig } from "vite";

const isGitHubActionsBuild = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  // Project Pages is served from /LinkQR/; local dev/preview uses the root.
  base: isGitHubActionsBuild ? "/LinkQR/" : "/",
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
