import type { CatalogQuery } from "@/server/catalog";
import { clampInt } from "@/lib/utils";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORTS = ["newest", "price_asc", "price_desc", "name", "featured"] as const;
type Sort = (typeof SORTS)[number];

const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** Parses URL query → validated catalog query. Prices in the URL are whole TRY. */
export type ParsedCatalogQuery = CatalogQuery & {
  q: string | null;
  sizes: string[];
  colors: string[];
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  sort: Sort;
  page: number;
};

export function parseCatalogParams(sp: RawSearchParams): ParsedCatalogQuery {
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const sizes = many(sp.size).filter((s) => /^[A-Z0-9-]{1,12}$/.test(s)).slice(0, 10);
  const colors = many(sp.color).filter((c) => /^[a-z0-9-]{1,40}$/.test(c)).slice(0, 10);
  const min = typeof sp.min === "string" && sp.min !== "" ? clampInt(sp.min, 0, 1_000_000, 0) : null;
  const max = typeof sp.max === "string" && sp.max !== "" ? clampInt(sp.max, 0, 1_000_000, 0) : null;
  const sortRaw = typeof sp.sort === "string" ? sp.sort : "newest";
  const sort: Sort = (SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as Sort) : "newest";
  return {
    q: q.length >= 2 ? q : null,
    sizes,
    colors,
    minPrice: min !== null ? min * 100 : null,
    maxPrice: max !== null ? max * 100 : null,
    inStock: sp.stock === "1",
    sort,
    page: clampInt(sp.page, 1, 500, 1),
  };
}

/** Builds a query string from current params with overrides (null removes). */
export function withParams(sp: RawSearchParams, overrides: Record<string, string | string[] | null>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k in overrides) continue;
    for (const item of many(v)) out.append(k, item);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) continue;
    for (const item of Array.isArray(v) ? v : [v]) out.append(k, item);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(sp: RawSearchParams): boolean {
  return ["q", "size", "color", "min", "max", "stock"].some((k) => many(sp[k]).some((v) => v !== ""));
}
