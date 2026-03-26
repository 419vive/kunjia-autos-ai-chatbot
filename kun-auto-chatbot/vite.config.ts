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
      output: {
        manualChunks: {
          // Core React runtime — always needed, cache-stable
          "vendor-react": ["react", "react-dom"],
          // Routing
          "vendor-router": ["wouter"],
          // Data fetching layer
          "vendor-query": ["@tanstack/react-query", "@trpc/react-query", "@trpc/client"],
          // Radix UI primitives (large but rarely changes)
          "vendor-radix": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-label",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
          // Lucide icons (heavy, but stable — good cache candidate)
          "vendor-icons": ["lucide-react"],
        },
      },
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
