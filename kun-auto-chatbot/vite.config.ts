import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// Rollup plugin: drop KaTeX font assets from the bundle.
// KaTeX is pulled in transitively (streamdown → rehype-katex → katex) but
// this app never renders math formulas.  The fonts (~2 MB, 60 files) are
// only needed for actual LaTeX rendering; removing them has no visible
// effect on a car-dealership chatbot.
const excludeKatexFonts = {
  name: "exclude-katex-fonts",
  generateBundle(
    _options: unknown,
    bundle: Record<string, { type: string; fileName: string }>
  ) {
    for (const key of Object.keys(bundle)) {
      const chunk = bundle[key];
      if (
        chunk.type === "asset" &&
        /KaTeX_.*\.(woff2?|ttf)$/i.test(chunk.fileName)
      ) {
        delete bundle[key];
      }
    }
  },
};

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // esbuild minifier is faster than terser (default in Vite 7)
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      plugins: [excludeKatexFonts],
    },
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
