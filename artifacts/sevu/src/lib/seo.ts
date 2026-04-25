import { useEffect } from "react";

function setMeta(name: string, content: string, isProperty = false) {
  if (!content) return;
  const attr = isProperty ? "property" : "name";
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    el.setAttribute("data-managed", "seo");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-managed="seo"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute("data-managed", "seo");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id: string, data: object) {
  let el = document.head.querySelector<HTMLScriptElement>(
    `script[type="application/ld+json"][data-id="${id}"]`,
  );
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-id", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  document.head
    .querySelector(`script[type="application/ld+json"][data-id="${id}"]`)
    ?.remove();
}

export interface SeoOptions {
  title: string;
  description: string;
  image?: string;
  canonical?: string;
  type?: "website" | "article" | "profile" | "business.business";
  keywords?: string[];
  jsonLd?: { id: string; data: object }[];
}

export function useSEO(opts: SeoOptions | null) {
  useEffect(() => {
    if (!opts) return;
    const prevTitle = document.title;
    document.title = opts.title;
    setMeta("description", opts.description);
    if (opts.keywords?.length) setMeta("keywords", opts.keywords.join(", "));

    setMeta("og:title", opts.title, true);
    setMeta("og:description", opts.description, true);
    setMeta("og:type", opts.type || "website", true);
    setMeta("og:site_name", "Sevu", true);
    if (opts.image) setMeta("og:image", opts.image, true);
    if (opts.canonical) {
      setMeta("og:url", opts.canonical, true);
      setLink("canonical", opts.canonical);
    }

    setMeta("twitter:card", opts.image ? "summary_large_image" : "summary");
    setMeta("twitter:title", opts.title);
    setMeta("twitter:description", opts.description);
    if (opts.image) setMeta("twitter:image", opts.image);

    const ids: string[] = [];
    for (const { id, data } of opts.jsonLd ?? []) {
      setJsonLd(id, data);
      ids.push(id);
    }

    return () => {
      document.title = prevTitle;
      for (const id of ids) removeJsonLd(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(opts)]);
}

export function siteOrigin(): string {
  // Allow explicit override (production deployments / canonical domain)
  const override = (import.meta as any).env?.VITE_BASE_URL as string | undefined;
  if (override) return override.replace(/\/+$/, "");
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

interface ProfileLike {
  name: string;
  slug: string;
  phone: string;
  service: string;
  city: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  profileImage?: string | null;
  shopImage?: string | null;
  description?: string | null;
  workImages?: string[] | null;
  priceRange?: string | null;
  isAvailable24x7?: boolean | null;
  yearsExperience?: number | null;
  servicesOffered?: string | null;
  openingHours?: string | null;
  website?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  rating: number;
  totalReviews: number;
  totalJobs: number;
  reviews?: Array<{
    id: number;
    reviewerName: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }>;
}

export function buildLocalBusinessSchema(p: ProfileLike, url: string) {
  const images = [p.profileImage, p.shopImage, ...(p.workImages || [])].filter(
    Boolean,
  ) as string[];

  const reviews = (p.reviews || []).slice(0, 5).map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.reviewerName },
    datePublished: r.createdAt,
    reviewBody: r.comment || undefined,
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.rating,
      bestRating: 5,
      worstRating: 1,
    },
  }));

  const sameAs: string[] = [];
  if (p.website)
    sameAs.push(
      p.website.startsWith("http") ? p.website : `https://${p.website}`,
    );
  if (p.instagram)
    sameAs.push(`https://instagram.com/${p.instagram.replace(/^@/, "")}`);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": url,
    name: p.name,
    url,
    image: images.length ? images : undefined,
    telephone: p.phone,
    priceRange: p.priceRange || "₹₹",
    description:
      p.description ||
      `${p.service} services in ${p.city}. Contact ${p.name} on Sevu.`,
    address: {
      "@type": "PostalAddress",
      streetAddress: p.address || undefined,
      addressLocality: p.city,
      addressRegion: p.city,
      addressCountry: "IN",
    },
    areaServed: { "@type": "City", name: p.city },
  };

  if (p.lat && p.lng) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: p.lat,
      longitude: p.lng,
    };
  }

  if (p.totalReviews > 0 && p.rating > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(p.rating.toFixed(1)),
      reviewCount: p.totalReviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviews.length) schema.review = reviews;

  if (p.isAvailable24x7) {
    schema.openingHoursSpecification = {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    };
  } else if (p.openingHours) {
    schema.openingHours = p.openingHours;
  }

  if (sameAs.length) schema.sameAs = sameAs;

  if (p.servicesOffered) {
    schema.makesOffer = p.servicesOffered
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s },
      }));
  }

  return schema;
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function buildFAQSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
