import "server-only";
import { cache } from "react";
import { createClient } from "@/server/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { pickLocale } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { Json, Tables } from "@/types/database.types";

export type SiteSettings = Tables<"site_settings">;

export const getSiteSettings = cache(async (): Promise<SiteSettings | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
  return data;
});

export type CategoryNode = { id: string; slug: string; name: string; description: string; image_path: string | null; parent_id: string | null; position: number };

export const getCategories = cache(async (locale: Locale): Promise<CategoryNode[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name, description, image_path, parent_id, position")
    .eq("is_active", true)
    .order("position");
  return (data ?? []).map((c) => ({ ...c, name: pickLocale(c.name, locale), description: pickLocale(c.description, locale) }));
});

export const getCategoryBySlug = cache(async (slug: string, locale: Locale) => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!data) return null;
  return {
    ...data,
    nameText: pickLocale(data.name, locale),
    descriptionText: pickLocale(data.description, locale),
    seoTitle: pickLocale(data.seo_title, locale),
    seoDescription: pickLocale(data.seo_description, locale),
  };
});

export const getCollections = cache(async (locale: Locale) => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("id, slug, name, description, image_path").eq("is_active", true).order("position");
  return (data ?? []).map((c) => ({ ...c, name: pickLocale(c.name, locale), description: pickLocale(c.description, locale) }));
});

export const getCollectionBySlug = cache(async (slug: string, locale: Locale) => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!data) return null;
  return { ...data, nameText: pickLocale(data.name, locale), descriptionText: pickLocale(data.description, locale) };
});

export const getSizes = cache(async (locale: Locale) => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("sizes").select("id, code, label, position").order("position");
  return (data ?? []).map((s) => ({ ...s, label: pickLocale(s.label, locale) || s.code }));
});

export const getColors = cache(async (locale: Locale) => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("colors").select("id, code, name, hex, position").order("position");
  return (data ?? []).map((c) => ({ ...c, name: pickLocale(c.name, locale) || c.code }));
});

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  coverPath: string | null;
  coverAlt: string;
  hoverPath: string | null;
  inStock: boolean;
  colorHexes: string[];
};

export type CatalogQuery = {
  category?: string | null;
  collection?: string | null;
  q?: string | null;
  sizes?: string[];
  colors?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "name" | "featured";
  page?: number;
  pageSize?: number;
  featured?: boolean;
  ids?: string[];
};

export const PAGE_SIZE = 12;

export async function searchProducts(locale: Locale, query: CatalogQuery): Promise<{ items: ProductCardData[]; total: number; page: number; pageCount: number }> {
  const pageSize = query.pageSize ?? PAGE_SIZE;
  if (!isSupabaseConfigured()) return { items: [], total: 0, page: 1, pageCount: 1 };
  const supabase = await createClient();
  const page = Math.max(1, query.page ?? 1);
  const { data, error } = await supabase.rpc("catalog_search", {
    p_locale: locale,
    p_category: query.category ?? undefined,
    p_collection: query.collection ?? undefined,
    p_q: query.q ?? undefined,
    p_sizes: query.sizes?.length ? query.sizes : undefined,
    p_colors: query.colors?.length ? query.colors : undefined,
    p_min_price: query.minPrice ?? undefined,
    p_max_price: query.maxPrice ?? undefined,
    p_in_stock: query.inStock ?? false,
    p_sort: query.sort ?? "newest",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
    p_featured: query.featured ?? false,
    p_ids: query.ids?.length ? query.ids : undefined,
  });
  if (error) {
    console.error("[catalog] search failed", error.message);
    throw new Error("catalog_unavailable");
  }
  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      price: r.price,
      compareAtPrice: (r.compare_at_price as number | null) ?? null,
      coverPath: (r.cover_path as string | null) ?? null,
      coverAlt: pickLocale(r.cover_alt as Json, locale) || r.name,
      hoverPath: (r.hover_path as string | null) ?? null,
      inStock: r.in_stock,
      colorHexes: r.color_hexes ?? [],
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export const getProductBySlug = cache(async (slug: string, locale: Locale) => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("products")
    .select(
      `id, slug, status, base_price, compare_at_price, is_demo, size_guide, category_id, updated_at,
       product_translations ( locale, name, description, material, care, seo_title, seo_description ),
       product_images ( id, path, alt, position, is_cover, color_id, width, height ),
       product_variants ( id, sku, price, compare_at_price, stock_on_hand, stock_reserved, low_stock_threshold, is_active, position, size_id, color_id ),
       categories ( id, slug, name )`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!p) return null;

  const t = p.product_translations.find((x) => x.locale === locale) ?? p.product_translations.find((x) => x.locale === "tr");
  const [sizes, colors] = await Promise.all([getSizes(locale), getColors(locale)]);
  const variants = p.product_variants
    .filter((v) => v.is_active)
    .sort((a, b) => a.position - b.position)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      sizeId: v.size_id,
      colorId: v.color_id,
      price: v.price ?? p.base_price,
      compareAtPrice: v.compare_at_price ?? p.compare_at_price,
      available: Math.max(0, v.stock_on_hand - v.stock_reserved),
      lowStockThreshold: v.low_stock_threshold,
    }));
  const usedSizeIds = new Set(variants.map((v) => v.sizeId).filter(Boolean));
  const usedColorIds = new Set(variants.map((v) => v.colorId).filter(Boolean));
  const images = [...p.product_images]
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position)
    .map((i) => ({ id: i.id, path: i.path, alt: pickLocale(i.alt, locale) || t?.name || p.slug, colorId: i.color_id, width: i.width, height: i.height }));

  return {
    id: p.id,
    slug: p.slug,
    isDemo: p.is_demo,
    name: t?.name ?? p.slug,
    description: t?.description ?? "",
    material: t?.material ?? "",
    care: t?.care ?? "",
    seoTitle: t?.seo_title ?? null,
    seoDescription: t?.seo_description ?? null,
    sizeGuide: pickLocale(p.size_guide, locale),
    basePrice: p.base_price,
    compareAtPrice: p.compare_at_price,
    updatedAt: p.updated_at,
    category: p.categories ? { id: p.categories.id, slug: p.categories.slug, name: pickLocale(p.categories.name, locale) } : null,
    images,
    variants,
    sizes: sizes.filter((s) => usedSizeIds.has(s.id)),
    colors: colors.filter((c) => usedColorIds.has(c.id)),
    hasTranslation: Boolean(p.product_translations.find((x) => x.locale === locale)),
  };
});

export async function getRelatedProducts(locale: Locale, product: { id: string; category: { slug: string } | null }, limit = 4) {
  const res = await searchProducts(locale, { category: product.category?.slug ?? null, pageSize: limit + 1, sort: "featured" });
  return res.items.filter((i) => i.id !== product.id).slice(0, limit);
}

export type HomepageSection = Tables<"homepage_sections">;

export const getHomepageSections = cache(async (): Promise<HomepageSection[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("homepage_sections").select("*").eq("is_active", true).order("position");
  return data ?? [];
});

export const getContentPage = cache(async (slug: string, locale: Locale) => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("content_pages").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (!data) return null;
  return {
    slug: data.slug,
    title: pickLocale(data.title, locale),
    body: pickLocale(data.body, locale),
    needsLegalReview: data.needs_legal_review,
    updatedAt: data.updated_at,
  };
});

export const getActiveShippingMethods = cache(async (locale: Locale) => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("shipping_methods")
    .select("id, code, name, description, price, free_over")
    .eq("is_active", true)
    .order("position");
  return (data ?? []).map((m) => ({ ...m, nameText: pickLocale(m.name, locale), descriptionText: pickLocale(m.description, locale) }));
});
