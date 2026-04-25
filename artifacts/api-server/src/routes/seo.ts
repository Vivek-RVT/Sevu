import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

function publicOrigin(req: Request): string {
  // Honour reverse-proxy headers so the URL matches the public host.
  const xfHost = (req.headers["x-forwarded-host"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const xfProto = (req.headers["x-forwarded-proto"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const host = xfHost || req.headers.host || "localhost";
  const proto =
    xfProto || (req.secure || host.includes("replit.") ? "https" : "http");
  // Allow override for production deployments.
  const override = process.env.PUBLIC_SITE_ORIGIN;
  if (override) return override.replace(/\/+$/, "");
  return `${proto}://${host}`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

router.get("/sitemap.xml", async (req, res) => {
  const origin = publicOrigin(req);

  const profiles = await db
    .select({
      slug: profilesTable.slug,
      city: profilesTable.city,
      service: profilesTable.service,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .orderBy(desc(profilesTable.createdAt))
    .limit(5000);

  const staticPages = [
    { loc: `${origin}/`, priority: "1.0", changefreq: "weekly" },
    { loc: `${origin}/profile`, priority: "0.9", changefreq: "daily" },
  ];

  // Build city/service combo pages so Google can index "near me"-style queries.
  const seen = new Set<string>();
  const comboPages: { loc: string; priority: string; changefreq: string }[] = [];
  for (const p of profiles) {
    const cityKey = p.city.toLowerCase();
    if (!seen.has(`c:${cityKey}`)) {
      seen.add(`c:${cityKey}`);
      comboPages.push({
        loc: `${origin}/profile?city=${encodeURIComponent(p.city)}`,
        priority: "0.7",
        changefreq: "weekly",
      });
    }
    const sk = `s:${p.service.toLowerCase()}::${cityKey}`;
    if (!seen.has(sk)) {
      seen.add(sk);
      comboPages.push({
        loc: `${origin}/profile?service=${encodeURIComponent(p.service)}&city=${encodeURIComponent(p.city)}`,
        priority: "0.8",
        changefreq: "weekly",
      });
    }
  }

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  for (const page of staticPages) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(page.loc)}</loc>`);
    lines.push(`    <changefreq>${page.changefreq}</changefreq>`);
    lines.push(`    <priority>${page.priority}</priority>`);
    lines.push("  </url>");
  }

  for (const page of comboPages) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(page.loc)}</loc>`);
    lines.push(`    <changefreq>${page.changefreq}</changefreq>`);
    lines.push(`    <priority>${page.priority}</priority>`);
    lines.push("  </url>");
  }

  for (const p of profiles) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(`${origin}/profile/${p.slug}`)}</loc>`);
    lines.push(`    <lastmod>${p.createdAt.toISOString().slice(0, 10)}</lastmod>`);
    lines.push("    <changefreq>weekly</changefreq>");
    lines.push("    <priority>0.9</priority>");
    lines.push("  </url>");
  }

  lines.push("</urlset>");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600");
  res.send(lines.join("\n"));
});

router.get("/robots.txt", (req, res) => {
  const origin = publicOrigin(req);
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /app/",
    "Disallow: /api/",
    "Disallow: /onboarding",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(body);
});

export default router;
