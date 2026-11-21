import { publicEnv } from "./env";

export const PRODUCT_BUCKET = "product-images";
export const SITE_BUCKET = "site-assets";

/**
 * Resolves a stored image path to a URL:
 * - "/demo/x.svg"          → bundled static asset (demo/placeholder)
 * - "https://…"            → absolute (already public)
 * - "products/abc/1.webp"  → public Supabase Storage URL in `bucket`
 */
export function imageUrl(path: string | null | undefined, bucket: string = PRODUCT_BUCKET): string | null {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("https://")) return path;
  if (!publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** SVG placeholders are served as-is (next/image does not optimise SVG). */
export function isUnoptimizable(src: string): boolean {
  return src.endsWith(".svg");
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
