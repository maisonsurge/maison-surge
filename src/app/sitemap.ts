import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { locales } from "@/i18n/config";

export const revalidate = 3600;

/** Public catalog URLs in both locales with hreflang alternates. Demo products are excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const entry = (path: string, lastModified?: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: `${base}/tr${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    priority,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])) },
  });

  const out: MetadataRoute.Sitemap = [entry("", undefined, 1), entry("/shop", undefined, 0.9), entry("/contact", undefined, 0.3)];
  if (!isSupabaseConfigured()) return out;

  // Anonymous client: RLS guarantees only published/active rows are visible.
  const db = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
  const [cats, cols, products, pages] = await Promise.all([
    db.from("categories").select("slug, updated_at").eq("is_active", true),
    db.from("collections").select("slug, updated_at").eq("is_active", true),
    db.from("products").select("slug, updated_at").eq("status", "published").eq("is_demo", false).limit(5000),
    db.from("content_pages").select("slug, updated_at, needs_legal_review").eq("is_published", true),
  ]);
  for (const c of cats.data ?? []) out.push(entry(`/shop/${c.slug}`, c.updated_at, 0.8));
  for (const c of cols.data ?? []) out.push(entry(`/collections/${c.slug}`, c.updated_at, 0.7));
  for (const p of products.data ?? []) out.push(entry(`/product/${p.slug}`, p.updated_at, 0.7));
  for (const p of pages.data ?? []) if (!p.needs_legal_review) out.push(entry(`/pages/${p.slug}`, p.updated_at, 0.3));
  return out;
}
