import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/sitemap.xml": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/sitemap\.xml$/, "/api/sitemap.xml"),
      },
      "/robots.txt": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/robots\.txt$/, "/api/robots.txt"),
      },
      // Social-media crawler SSR: WhatsApp / Facebook / Twitter / LinkedIn
      // do NOT execute JS, so they can't see useSEO()-injected meta tags.
      // For known crawler User-Agents we forward /profile/* to the API server
      // which returns minimal HTML with og:image, og:title, og:description
      // pre-baked. Real users continue to get the SPA from Vite.
      "/profile": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        xfwd: true, // Forward X-Forwarded-Host so SSR meta tags use the public origin
        bypass: (req) => {
          const ua = (req.headers["user-agent"] || "").toString();
          const isCrawler =
            /facebookexternalhit|facebookcatalog|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|skypeuripreview|pinterest|redditbot|googlebot|bingbot|applebot|yandex|duckduckbot|embedly/i.test(
              ua,
            );
          // Only intercept exact /profile/<slug> paths (not /profile or /profile?…)
          const isProfilePath = /^\/profile\/[^/?#]+\/?$/.test(
            req.url || "",
          );
          if (isCrawler && isProfilePath) {
            // Rewrite /profile/foo → /api/seo/profile/foo so it reaches the API
            req.url = (req.url || "").replace(
              /^\/profile\//,
              "/api/seo/profile/",
            );
            return undefined; // proxy through
          }
          return req.url; // bypass: serve from Vite as normal
        },
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
