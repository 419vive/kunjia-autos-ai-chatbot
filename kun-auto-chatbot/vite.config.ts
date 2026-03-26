import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss()];

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
      output: {
        manualChunks(id) {
          // --- Shiki: consolidate hundreds of language grammars + themes ---
          if (id.includes("shiki") || id.includes("@shikijs")) {
            if (id.includes("/themes/")) return "vendor-shiki-themes";
            if (id.includes("/langs/")) return "vendor-shiki-langs";
            // shiki core goes into vendor-markdown to avoid circular deps
            return "vendor-markdown";
          }
          // --- Mermaid: consolidate all diagram modules ---
          if (id.includes("mermaid") || id.includes("cytoscape") || id.includes("cose-bilkent") || id.includes("dagre") || id.includes("d3") || id.includes("elkjs")) {
            return "vendor-mermaid";
          }
          // --- KaTeX + Streamdown + remark/rehype ecosystem ---
          // Merged into one chunk to avoid circular deps (katex <-> rehype-katex <-> streamdown)
          if (id.includes("katex") || id.includes("rehype-katex")) {
            return "vendor-markdown";
          }
          if (id.includes("streamdown") || id.includes("remark-") || id.includes("rehype-") || id.includes("unified") || id.includes("hast-") || id.includes("mdast-") || id.includes("micromark") || id.includes("remend")) {
            return "vendor-markdown";
          }
          // --- React core ---
          if (id.includes("react-dom") || (id.includes("/react/") && id.includes("node_modules"))) {
            return "vendor-react";
          }
          // --- Radix UI ---
          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }
          // --- Charts ---
          if (id.includes("recharts") || id.includes("victory")) {
            return "vendor-charts";
          }
          // --- Framer Motion ---
          if (id.includes("framer-motion")) {
            return "vendor-motion";
          }
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
