import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import * as db from "../db";

// Inject OG meta tags for vehicle pages (social sharing preview on LINE/FB)
async function injectVehicleOgTags(html: string, url: string): Promise<string> {
  const vehicleMatch = url.match(/^\/vehicle\/(\d+)/);
  if (!vehicleMatch) return html;

  try {
    const vehicleId = parseInt(vehicleMatch[1], 10);
    const vehicle = await db.getVehicleById(vehicleId);
    if (!vehicle) return html;

    const name = `${vehicle.brand} ${vehicle.model}`;
    const year = vehicle.modelYear ? `${vehicle.modelYear}年` : "";
    const price = vehicle.priceDisplay || `${vehicle.price}萬`;
    const desc = `${year} ${name} ${price} — 第三方認證、超強貸款、免費接駁｜崑家汽車`;

    // Parse first photo URL
    let photoUrl = "";
    const raw = (vehicle.photoUrls as string) || "";
    if (raw.startsWith("[")) {
      try { photoUrl = JSON.parse(raw)[0] || ""; } catch {}
    } else if (raw.includes("|")) {
      photoUrl = raw.split("|")[0] || "";
    } else if (raw.startsWith("http")) {
      photoUrl = raw;
    }

    const ogTags = `
    <meta property="og:title" content="${name} ${year} ${price} | 崑家汽車" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="product" />
    ${photoUrl ? `<meta property="og:image" content="${photoUrl}" />` : ""}
    <meta property="og:site_name" content="崑家汽車" />
    <meta name="description" content="${desc}" />
    <title>${name} ${year} ${price} | 崑家汽車</title>`;

    // Inject before </head>
    return html.replace("</head>", `${ogTags}\n</head>`);
  } catch (err) {
    console.error("[OG] Failed to inject vehicle OG tags:", err);
    return html;
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page = await vite.transformIndexHtml(url, template);
      page = await injectVehicleOgTags(page, url);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // Inject OG tags for vehicle pages (social sharing on LINE/FB)
  app.use("*", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    try {
      let html = await fs.promises.readFile(indexPath, "utf-8");
      html = await injectVehicleOgTags(html, req.originalUrl);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch {
      res.sendFile(indexPath);
    }
  });
}
