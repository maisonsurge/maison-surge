import type { Metadata } from "next";
import { publicEnv } from "./env";
import { locales, type Locale } from "@/i18n/config";

export function absoluteUrl(path: string): string {
  return `${publicEnv.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Canonical + hreflang alternates for a locale-agnostic path ("/shop/polo").
 * x-default points to the Turkish (primary) version.
 */
export function buildMetadata({
  locale,
  path,
  title,
  description,
  image,
  noindex = false,
  type = "website",
}: {
  locale: Locale;
  path: string;
  title?: string;
  description?: string;
  image?: string | null;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const clean = path === "/" ? "" : path;
  const languages: Record<string, string> = Object.fromEntries(locales.map((l) => [l, absoluteUrl(`/${l}${clean}`)]));
  languages["x-default"] = absoluteUrl(`/tr${clean}`);
  const url = absoluteUrl(`/${locale}${clean}`);
  const images = image ? [{ url: image.startsWith("http") ? image : absoluteUrl(image) }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, siteName: "MAISON SURGE", locale: locale === "tr" ? "tr_TR" : "en_GB", type, images },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

/** Serialises JSON-LD safely for a <script> tag (prevents </script> breakout). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
