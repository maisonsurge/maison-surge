"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, PRODUCT_BUCKET } from "@/lib/images";
import { createClient } from "@/server/supabase/server";
import { createServiceClient } from "@/server/supabase/admin";
import { SKU_RE, SLUG_RE } from "@/features/admin/lib/helpers";
import { authorize, bool, dbFail, intField, isUuid, moneyField, optStr, revalidateStorefront, str, strs, zodFail } from "./common";

const INVALID = -1;
const money = (v: number | undefined | null, required = false) => (v === undefined ? (required ? INVALID : null) : v === null ? INVALID : v);

const productSchema = z
  .object({
    slug: z.string().regex(SLUG_RE, "Slug yalnızca küçük harf, rakam ve tire içerebilir.").max(80, "En fazla 80 karakter."),
    category_id: z.uuid().nullable(),
    status: z.enum(["draft", "published", "archived"]),
    is_featured: z.boolean(),
    base_price: z.number().int().min(0, "Geçerli bir satış fiyatı girin."),
    compare_at_price: z.number().int().min(1, "Geçerli bir karşılaştırma fiyatı girin.").nullable(),
    cost_price: z.number().int().min(0, "Geçerli bir maliyet girin.").nullable(),
    size_guide_tr: z.string().max(5000),
    size_guide_en: z.string().max(5000),
    tr_name: z.string().min(1, "Türkçe ürün adı zorunludur.").max(160),
    tr_description: z.string().max(10000),
    tr_material: z.string().max(2000),
    tr_care: z.string().max(2000),
    tr_seo_title: z.string().max(70, "SEO başlığı en fazla 70 karakter.").nullable(),
    tr_seo_description: z.string().max(170, "SEO açıklaması en fazla 170 karakter.").nullable(),
    en_name: z.string().max(160),
    en_description: z.string().max(10000),
    en_material: z.string().max(2000),
    en_care: z.string().max(2000),
    en_seo_title: z.string().max(70, "SEO başlığı en fazla 70 karakter.").nullable(),
    en_seo_description: z.string().max(170, "SEO açıklaması en fazla 170 karakter.").nullable(),
    collection_ids: z.array(z.uuid()),
  })
  .refine((v) => v.compare_at_price === null || v.compare_at_price > v.base_price, {
    path: ["compare_at_price"],
    message: "Karşılaştırma fiyatı satış fiyatından yüksek olmalı.",
  })
  .refine((v) => !(v.en_name === "" && (v.en_description || v.en_material || v.en_care)), {
    path: ["en_name"],
    message: "İngilizce içerik girildiyse İngilizce ad da zorunludur.",
  });

function readProduct(fd: FormData) {
  return {
    slug: str(fd, "slug").toLowerCase(),
    category_id: optStr(fd, "category_id"),
    status: str(fd, "status") || "draft",
    is_featured: bool(fd, "is_featured"),
    base_price: money(moneyField(fd, "base_price"), true),
    compare_at_price: money(moneyField(fd, "compare_at_price")),
    cost_price: money(moneyField(fd, "cost_price")),
    size_guide_tr: str(fd, "size_guide_tr"),
    size_guide_en: str(fd, "size_guide_en"),
    tr_name: str(fd, "tr_name"),
    tr_description: str(fd, "tr_description"),
    tr_material: str(fd, "tr_material"),
    tr_care: str(fd, "tr_care"),
    tr_seo_title: optStr(fd, "tr_seo_title"),
    tr_seo_description: optStr(fd, "tr_seo_description"),
    en_name: str(fd, "en_name"),
    en_description: str(fd, "en_description"),
    en_material: str(fd, "en_material"),
    en_care: str(fd, "en_care"),
    en_seo_title: optStr(fd, "en_seo_title"),
    en_seo_description: optStr(fd, "en_seo_description"),
    collection_ids: strs(fd, "collection_ids"),
  };
}

function revalidateProduct(id?: string) {
  revalidatePath("/admin/products");
  if (id) revalidatePath(`/admin/products/${id}`);
  revalidateStorefront();
}

export async function saveProduct(productId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (productId !== null && !isUuid(productId)) return { ok: false, message: "Geçersiz ürün." };

  const parsed = productSchema.safeParse(readProduct(fd));
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();

  const sizeGuide: { tr?: string; en?: string } = {};
  if (v.size_guide_tr) sizeGuide.tr = v.size_guide_tr;
  if (v.size_guide_en) sizeGuide.en = v.size_guide_en;
  const productRow = {
    slug: v.slug,
    category_id: v.category_id,
    status: v.status,
    is_featured: v.is_featured,
    base_price: v.base_price,
    compare_at_price: v.compare_at_price,
    size_guide: sizeGuide,
  };

  let id = productId;
  if (id === null) {
    const { data, error } = await supabase.from("products").insert(productRow).select("id").single();
    if (error) return dbFail(error, "product insert");
    id = data.id;
  } else {
    const { error } = await supabase.from("products").update(productRow).eq("id", id);
    if (error) return dbFail(error, "product update");
  }

  const fail = async (error: { message?: string; code?: string }, ctx: string) => {
    if (productId === null && id) await supabase.from("products").delete().eq("id", id); // roll back a half-created product
    return dbFail(error, ctx);
  };

  const translations = [
    {
      product_id: id,
      locale: "tr",
      name: v.tr_name,
      description: v.tr_description,
      material: v.tr_material,
      care: v.tr_care,
      seo_title: v.tr_seo_title,
      seo_description: v.tr_seo_description,
    },
  ];
  if (v.en_name) {
    translations.push({
      product_id: id,
      locale: "en",
      name: v.en_name,
      description: v.en_description,
      material: v.en_material,
      care: v.en_care,
      seo_title: v.en_seo_title,
      seo_description: v.en_seo_description,
    });
  }
  const tRes = await supabase.from("product_translations").upsert(translations, { onConflict: "product_id,locale" });
  if (tRes.error) return fail(tRes.error, "translations");
  if (!v.en_name) await supabase.from("product_translations").delete().eq("product_id", id).eq("locale", "en");

  if (v.cost_price === null) {
    await supabase.from("product_costs").delete().eq("product_id", id);
  } else {
    const cRes = await supabase.from("product_costs").upsert({ product_id: id, cost_price: v.cost_price }, { onConflict: "product_id" });
    if (cRes.error) return fail(cRes.error, "cost");
  }

  // Sync collection membership.
  const { data: current } = await supabase.from("collection_products").select("collection_id").eq("product_id", id);
  const have = new Set((current ?? []).map((r) => r.collection_id));
  const want = new Set(v.collection_ids);
  const toRemove = [...have].filter((c) => !want.has(c));
  const toAdd = [...want].filter((c) => !have.has(c));
  if (toRemove.length) await supabase.from("collection_products").delete().eq("product_id", id).in("collection_id", toRemove);
  if (toAdd.length) {
    const aRes = await supabase.from("collection_products").insert(toAdd.map((collection_id) => ({ collection_id, product_id: id, position: 999 })));
    if (aRes.error) return fail(aRes.error, "collections");
  }

  revalidateProduct(id);
  if (productId === null) redirect(`/admin/products/${id}?created=1`);
  return { ok: true, message: "Ürün kaydedildi." };
}

export async function duplicateProduct(productId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId)) return { ok: false, message: "Geçersiz ürün." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_duplicate_product", { p_product_id: productId });
  if (error || !data) return dbFail(error, "duplicate");
  revalidateProduct();
  return { ok: true, message: "Ürün taslak olarak kopyalandı.", data: { redirect: `/admin/products/${data}` } };
}

/** Removes storage objects that no product_images row references any more. */
async function cleanupStorage(paths: string[]) {
  const candidates = [...new Set(paths.filter((p) => p && !p.startsWith("/") && !p.startsWith("http")))];
  if (!candidates.length) return;
  const supabase = await createClient();
  const { data: stillUsed } = await supabase.from("product_images").select("path").in("path", candidates);
  const used = new Set((stillUsed ?? []).map((r) => r.path));
  const orphan = candidates.filter((p) => !used.has(p));
  if (!orphan.length) return;
  const { error } = await createServiceClient().storage.from(PRODUCT_BUCKET).remove(orphan);
  if (error) console.error("[admin] storage cleanup failed", error.message);
}

export async function deleteProduct(productId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId)) return { ok: false, message: "Geçersiz ürün." };
  const supabase = await createClient();
  const { data: imgs } = await supabase.from("product_images").select("path").eq("product_id", productId);
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Bu ürünün aktif stok rezervasyonları veya bağlı kayıtları var; silinemez. Bunun yerine durumunu “Arşiv” yapın." };
    }
    return dbFail(error, "product delete");
  }
  await cleanupStorage((imgs ?? []).map((i) => i.path));
  revalidateProduct();
  return { ok: true, message: "Ürün silindi.", data: { redirect: "/admin/products" } };
}

// ---------------------------------------------------------------------------
// Variants & stock
// ---------------------------------------------------------------------------
const variantSchema = z.object({
  sku: z.string().regex(SKU_RE, "SKU büyük harf, rakam ve tire içermeli (2–48 karakter)."),
  size_id: z.uuid().nullable(),
  color_id: z.uuid().nullable(),
  price: z.number().int().min(0, "Geçerli bir fiyat girin.").nullable(),
  compare_at_price: z.number().int().min(1, "Geçerli bir karşılaştırma fiyatı girin.").nullable(),
  low_stock_threshold: z.number().int().min(0, "0 veya daha büyük olmalı.").max(100000),
  position: z.number().int().min(0).max(100000),
  is_active: z.boolean(),
  stock_on_hand: z.number().int().min(0, "Stok 0 veya daha büyük olmalı.").max(1000000),
});

export async function saveVariant(productId: string, variantId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId) || (variantId !== null && !isUuid(variantId))) return { ok: false, message: "Geçersiz kayıt." };
  const intOr = (key: string, fallback: number) => {
    const n = intField(fd, key);
    return n === undefined ? fallback : n === null ? -1 : n;
  };
  const parsed = variantSchema.safeParse({
    sku: str(fd, "sku").toUpperCase(),
    size_id: optStr(fd, "size_id"),
    color_id: optStr(fd, "color_id"),
    price: money(moneyField(fd, "price")),
    compare_at_price: money(moneyField(fd, "compare_at_price")),
    low_stock_threshold: intOr("low_stock_threshold", 3),
    position: intOr("position", 0),
    is_active: bool(fd, "is_active"),
    stock_on_hand: intOr("stock_on_hand", 0),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const { stock_on_hand, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } =
    variantId === null
      ? await supabase.from("product_variants").insert({ ...row, product_id: productId, stock_on_hand })
      : await supabase.from("product_variants").update(row).eq("id", variantId).eq("product_id", productId);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Bu SKU veya beden/renk kombinasyonu bu üründe zaten var." };
    return dbFail(error, "variant save");
  }
  revalidateProduct(productId);
  revalidatePath("/admin/inventory");
  return { ok: true, message: variantId ? "Varyant güncellendi." : "Varyant eklendi." };
}

export async function deleteVariant(productId: string, variantId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId) || !isUuid(variantId)) return { ok: false, message: "Geçersiz kayıt." };
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", variantId).eq("product_id", productId);
  if (error) {
    if (error.code === "23503") return { ok: false, message: "Bu varyantın aktif/geçmiş stok rezervasyonu var; silinemez. Pasif yapabilirsiniz." };
    return dbFail(error, "variant delete");
  }
  revalidateProduct(productId);
  revalidatePath("/admin/inventory");
  return { ok: true, message: "Varyant silindi." };
}

const stockSchema = z.object({
  on_hand: z.number().int().min(0, "Stok 0 veya daha büyük olmalı.").max(1000000),
  reason: z.string().min(3, "Gerekçe en az 3 karakter olmalı.").max(500),
});

export async function setVariantStock(variantId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("inventory.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(variantId)) return { ok: false, message: "Geçersiz varyant." };
  const n = intField(fd, "on_hand");
  const parsed = stockSchema.safeParse({ on_hand: n === undefined || n === null ? -1 : n, reason: str(fd, "reason") || "Manuel stok güncelleme" });
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_variant_stock", { p_variant_id: variantId, p_on_hand: parsed.data.on_hand, p_reason: parsed.data.reason });
  if (error) return dbFail(error, "set stock");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products", "layout");
  revalidateStorefront();
  return { ok: true, message: "Stok güncellendi." };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
const fileMetaSchema = z
  .array(
    z.object({
      name: z.string().max(200),
      type: z.enum(ALLOWED_IMAGE_TYPES, "Desteklenmeyen dosya türü (JPEG, PNG, WebP, AVIF)."),
      size: z.number().int().positive().max(MAX_IMAGE_BYTES, "Dosya en fazla 8 MB olabilir."),
    }),
  )
  .min(1)
  .max(12, "Tek seferde en fazla 12 görsel yükleyin.");

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export async function createProductImageUploads(
  productId: string,
  files: { name: string; type: string; size: number }[],
): Promise<ActionState<{ uploads: { path: string; token: string }[] }>> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return { ok: false, message: auth.state.message };
  if (!isUuid(productId)) return { ok: false, message: "Geçersiz ürün." };
  const parsed = fileMetaSchema.safeParse(files);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz dosya." };
  const storage = createServiceClient().storage.from(PRODUCT_BUCKET);
  const uploads: { path: string; token: string }[] = [];
  for (const f of parsed.data) {
    const path = `products/${productId}/${randomUUID()}.${EXT[f.type]}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) return { ok: false, message: "Yükleme bağlantısı oluşturulamadı. Storage bucket yapılandırmasını kontrol edin." };
    uploads.push({ path: data.path, token: data.token });
  }
  return { ok: true, data: { uploads } };
}

const registerSchema = z
  .array(z.object({ path: z.string().max(300), width: z.number().int().positive().max(20000).nullable(), height: z.number().int().positive().max(20000).nullable() }))
  .min(1)
  .max(12);

export async function registerProductImages(productId: string, images: { path: string; width: number | null; height: number | null }[]): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId)) return { ok: false, message: "Geçersiz ürün." };
  const parsed = registerSchema.safeParse(images);
  if (!parsed.success) return { ok: false, message: "Geçersiz görsel bilgisi." };
  // Only paths issued for this product can be registered.
  if (parsed.data.some((i) => !i.path.startsWith(`products/${productId}/`) || i.path.includes(".."))) return { ok: false, message: "Geçersiz görsel yolu." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("product_images").select("position, is_cover").eq("product_id", productId);
  const start = Math.max(-1, ...(existing ?? []).map((i) => i.position)) + 1;
  const hasCover = (existing ?? []).some((i) => i.is_cover);
  const { error } = await supabase.from("product_images").insert(
    parsed.data.map((img, i) => ({ product_id: productId, path: img.path, width: img.width, height: img.height, position: start + i, is_cover: !hasCover && i === 0 })),
  );
  if (error) return dbFail(error, "register images");
  revalidateProduct(productId);
  return { ok: true, message: `${parsed.data.length} görsel eklendi.` };
}

export async function updateProductImage(productId: string, imageId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId) || !isUuid(imageId)) return { ok: false, message: "Geçersiz kayıt." };
  const altTr = str(fd, "alt_tr").slice(0, 200);
  const altEn = str(fd, "alt_en").slice(0, 200);
  const colorId = optStr(fd, "color_id");
  if (colorId !== null && !isUuid(colorId)) return { ok: false, message: "Geçersiz renk." };
  const alt: { tr?: string; en?: string } = {};
  if (altTr) alt.tr = altTr;
  if (altEn) alt.en = altEn;
  const supabase = await createClient();
  const { error } = await supabase.from("product_images").update({ alt, color_id: colorId }).eq("id", imageId).eq("product_id", productId);
  if (error) return dbFail(error, "image update");
  revalidateProduct(productId);
  return { ok: true, message: "Görsel bilgileri kaydedildi." };
}

export async function setCoverImage(productId: string, imageId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId) || !isUuid(imageId)) return { ok: false, message: "Geçersiz kayıt." };
  const supabase = await createClient();
  // Partial unique index allows one cover per product: unset first, then set.
  const a = await supabase.from("product_images").update({ is_cover: false }).eq("product_id", productId).eq("is_cover", true);
  if (a.error) return dbFail(a.error, "unset cover");
  const b = await supabase.from("product_images").update({ is_cover: true }).eq("id", imageId).eq("product_id", productId);
  if (b.error) return dbFail(b.error, "set cover");
  revalidateProduct(productId);
  return { ok: true, message: "Kapak görseli güncellendi." };
}

export async function moveProductImage(productId: string, imageId: string, dir: -1 | 1): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId) || !isUuid(imageId) || (dir !== -1 && dir !== 1)) return { ok: false, message: "Geçersiz kayıt." };
  const supabase = await createClient();
  const { data } = await supabase.from("product_images").select("id, position, created_at").eq("product_id", productId).order("position").order("created_at");
  const list = data ?? [];
  const idx = list.findIndex((i) => i.id === imageId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= list.length) return { ok: true };
  const reordered = [...list];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(target, 0, moved!);
  for (let i = 0; i < reordered.length; i++) {
    if (reordered[i]!.position !== i) {
      const { error } = await supabase.from("product_images").update({ position: i }).eq("id", reordered[i]!.id);
      if (error) return dbFail(error, "reorder");
    }
  }
  revalidateProduct(productId);
  return { ok: true };
}

export async function deleteProductImage(productId: string, imageId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(productId) || !isUuid(imageId)) return { ok: false, message: "Geçersiz kayıt." };
  const supabase = await createClient();
  const { data: img } = await supabase.from("product_images").select("path, is_cover").eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (!img) return { ok: false, message: "Görsel bulunamadı." };
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return dbFail(error, "image delete");
  if (img.is_cover) {
    const { data: next } = await supabase.from("product_images").select("id").eq("product_id", productId).order("position").limit(1).maybeSingle();
    if (next) await supabase.from("product_images").update({ is_cover: true }).eq("id", next.id);
  }
  await cleanupStorage([img.path]);
  revalidateProduct(productId);
  return { ok: true, message: "Görsel silindi." };
}
