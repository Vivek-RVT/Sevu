import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { profilesTable, profileReviewsTable } from "@workspace/db/schema";
import { desc, eq, count, sql } from "drizzle-orm";
import { Resvg } from "@resvg/resvg-js";

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

// ── OG image generator ────────────────────────────────────────────────────
// Generates a 1200x630 PNG suitable for WhatsApp/FB/Twitter previews.
// Cached in-memory per slug for 6 hours.

const ogCache = new Map<string, { png: Buffer; expires: number }>();
const OG_TTL_MS = 6 * 60 * 60 * 1000;

const SERVICE_GRADIENTS: Record<string, [string, string]> = {
  electrician:   ["#1e3c72", "#2a5298"],
  salon:         ["#6a11cb", "#2575fc"],
  barbershop:    ["#6a11cb", "#2575fc"],
  plumber:       ["#134e5e", "#71b280"],
  ac:            ["#0f2027", "#2c5364"],
  carpenter:     ["#603813", "#b29f94"],
  gym:           ["#ff512f", "#dd2476"],
  fitness:       ["#ff512f", "#dd2476"],
  doctor:        ["#1d976c", "#93f9b9"],
  default:       ["#1a1a2e", "#16213e"],
};

function pickGradient(service: string): [string, string] {
  const s = service.toLowerCase();
  for (const key of Object.keys(SERVICE_GRADIENTS)) {
    if (key !== "default" && s.includes(key)) return SERVICE_GRADIENTS[key];
  }
  return SERVICE_GRADIENTS.default;
}

function svgEscape(s: string): string {
  return (s || "").replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === "&" ? "&amp;" :
    c === "'" ? "&apos;" :
    "&quot;",
  );
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

router.get("/og/:slug.png", async (req, res) => {
  const slug = req.params.slug;
  if (!slug || slug.length > 200) {
    res.status(400).send("Invalid slug");
    return;
  }

  // Serve from cache if fresh
  const cached = ogCache.get(slug);
  if (cached && cached.expires > Date.now()) {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600");
    res.setHeader("X-Cache", "HIT");
    res.send(cached.png);
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.slug, slug));

  if (!profile) {
    res.status(404).send("Profile not found");
    return;
  }

  // Recent reviews count for trust
  const [{ value: reviewCount }] = await db
    .select({ value: count() })
    .from(profileReviewsTable)
    .where(eq(profileReviewsTable.profileId, profile.id));

  const [g1, g2] = pickGradient(profile.service);
  const name = truncate(profile.name, 32);
  const subtitle = truncate(`${profile.service} · ${profile.city}`, 50);
  const rating = Number(profile.rating || 0).toFixed(1);
  const ratingText = profile.totalReviews > 0 ? `★ ${rating}/5` : "★ New";
  const jobsText = profile.totalJobs > 0
    ? `${profile.totalJobs.toLocaleString("en-IN")} jobs done`
    : "Just joined Sevu";
  const reviewsText = reviewCount > 0
    ? `${reviewCount} review${reviewCount > 1 ? "s" : ""}`
    : "Verified business";
  const services = (profile.servicesOffered || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  // Build SVG (1200×630)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${g1}"/>
      <stop offset="100%" stop-color="${g2}"/>
    </linearGradient>
    <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#overlay)"/>

  <!-- Decorative circles -->
  <circle cx="1080" cy="80" r="180" fill="rgba(255,255,255,0.06)"/>
  <circle cx="1150" cy="540" r="120" fill="rgba(255,255,255,0.04)"/>

  <!-- Sevu watermark top-right -->
  <g transform="translate(1050, 60)">
    <rect x="0" y="0" width="100" height="36" rx="18" fill="rgba(255,255,255,0.18)"/>
    <text x="50" y="24" font-family="Arial, sans-serif" font-size="18" font-weight="700"
          fill="white" text-anchor="middle" letter-spacing="2">SEVU</text>
  </g>

  <!-- Logo placeholder block -->
  <rect x="60" y="180" width="120" height="120" rx="24" fill="white" opacity="0.95"/>
  <text x="120" y="263" font-family="Arial, sans-serif" font-size="72" font-weight="800"
        fill="${g1}" text-anchor="middle">${svgEscape(profile.name.charAt(0).toUpperCase())}</text>

  <!-- Verified badge -->
  <g transform="translate(220, 195)">
    <rect x="0" y="0" width="140" height="34" rx="17" fill="#25D366"/>
    <text x="70" y="23" font-family="Arial, sans-serif" font-size="16" font-weight="700"
          fill="white" text-anchor="middle">✓ VERIFIED</text>
  </g>

  <!-- Business name -->
  <text x="220" y="270" font-family="Arial, sans-serif" font-size="56" font-weight="800"
        fill="white">${svgEscape(name)}</text>

  <!-- Subtitle -->
  <text x="220" y="310" font-family="Arial, sans-serif" font-size="26" font-weight="500"
        fill="rgba(255,255,255,0.85)">${svgEscape(subtitle)}</text>

  <!-- Stats row -->
  <g transform="translate(60, 380)">
    <!-- Rating pill -->
    <rect x="0" y="0" width="180" height="64" rx="18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    <text x="90" y="42" font-family="Arial, sans-serif" font-size="24" font-weight="700"
          fill="#fbbf24" text-anchor="middle">${svgEscape(ratingText)}</text>

    <!-- Jobs pill -->
    <rect x="200" y="0" width="280" height="64" rx="18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    <text x="340" y="42" font-family="Arial, sans-serif" font-size="22" font-weight="600"
          fill="white" text-anchor="middle">💼 ${svgEscape(jobsText)}</text>

    <!-- Reviews pill -->
    <rect x="500" y="0" width="240" height="64" rx="18" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    <text x="620" y="42" font-family="Arial, sans-serif" font-size="22" font-weight="600"
          fill="white" text-anchor="middle">${svgEscape(reviewsText)}</text>
  </g>

  ${services.length > 0 ? `
  <!-- Service tags -->
  <g transform="translate(60, 480)">
    ${services.map((s, i) => {
      const x = i * 280;
      return `<g transform="translate(${x}, 0)">
        <rect x="0" y="0" width="260" height="48" rx="12" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.20)" stroke-width="1"/>
        <text x="130" y="32" font-family="Arial, sans-serif" font-size="18" font-weight="500"
              fill="rgba(255,255,255,0.95)" text-anchor="middle">${svgEscape(truncate(s, 22))}</text>
      </g>`;
    }).join("")}
  </g>` : ""}

  <!-- Footer URL -->
  <text x="60" y="585" font-family="Arial, sans-serif" font-size="20" font-weight="500"
        fill="rgba(255,255,255,0.7)">${svgEscape(publicOrigin(req).replace(/^https?:\/\//, ""))}/profile/${svgEscape(slug)}</text>

  ${profile.priceRange ? `
  <text x="1140" y="585" font-family="Arial, sans-serif" font-size="20" font-weight="700"
        fill="rgba(255,255,255,0.9)" text-anchor="end">${svgEscape(profile.priceRange)}</text>` : ""}

  ${profile.phone ? `
  <text x="1140" y="555" font-family="Arial, sans-serif" font-size="16" font-weight="500"
        fill="rgba(255,255,255,0.6)" text-anchor="end">📞 ${svgEscape(profile.phone)}</text>` : ""}
</svg>`;

  try {
    const resvg = new Resvg(svg, {
      background: "white",
      fitTo: { mode: "width", value: 1200 },
      font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
    });
    const pngData = resvg.render().asPng();
    const png = Buffer.from(pngData);

    ogCache.set(slug, { png, expires: Date.now() + OG_TTL_MS });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600");
    res.setHeader("X-Cache", "MISS");
    res.send(png);
  } catch (err) {
    // Fail silently with a tiny transparent PNG so social cards don't break
    res.status(500).send("OG render failed");
  }
});

// ── Crawler SSR for /profile/:slug ──────────────────────────────────────
// Returns a minimal HTML document with og:image, og:title, og:description,
// twitter:* and JSON-LD pre-baked, so social-media crawlers (which do NOT
// execute JavaScript) get a proper preview card instead of the bare SPA
// shell. The Vite dev proxy and any production CDN should route requests
// to this endpoint only when the User-Agent matches a known crawler.
router.get("/seo/profile/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug || slug.length > 200) {
    res.status(400).send("Invalid slug");
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.slug, slug));

  if (!profile) {
    res.status(404).type("html").send(
      `<!doctype html><meta charset="utf-8"><title>Not found</title>`,
    );
    return;
  }

  const origin = publicOrigin(req);
  const url = `${origin}/profile/${profile.slug}`;
  const ratingTxt =
    profile.totalReviews > 0
      ? `★ ${Number(profile.rating).toFixed(1)} (${profile.totalReviews} reviews) · `
      : "";
  const title = `${profile.name} — ${profile.service} in ${profile.city} | Sevu`;
  const description = profile.description
    ? `${ratingTxt}${profile.description.slice(0, 150)}`
    : `${ratingTxt}Book ${profile.name} for ${profile.service} services in ${profile.city}. Call or WhatsApp now.`;
  const image = `${origin}/api/og/${profile.slug}.png`;

  const esc = (s: string) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      c === "&" ? "&amp;" :
      c === "<" ? "&lt;" :
      c === ">" ? "&gt;" :
      c === '"' ? "&quot;" :
      "&#39;",
    );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": url,
    name: profile.name,
    url,
    image,
    telephone: `+91${profile.phone}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.city,
      addressRegion: profile.city,
      addressCountry: "IN",
      streetAddress: profile.address || undefined,
    },
    aggregateRating:
      profile.totalReviews > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(profile.rating).toFixed(1),
            reviewCount: profile.totalReviews,
          }
        : undefined,
    priceRange: profile.priceRange || undefined,
    description: profile.description || undefined,
  };

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />

  <!-- Open Graph (WhatsApp, Facebook, LinkedIn) -->
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Sevu" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:secure_url" content="${esc(image)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(profile.name)} — ${esc(profile.service)} in ${esc(profile.city)}" />
  <meta property="og:locale" content="en_IN" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <h1>${esc(profile.name)}</h1>
  <p>${esc(profile.service)} in ${esc(profile.city)}</p>
  ${profile.description ? `<p>${esc(profile.description)}</p>` : ""}
  <p><a href="${esc(url)}">View full profile on Sevu</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
  res.setHeader("X-Robots-Tag", "all");
  res.send(html);
});

export default router;
