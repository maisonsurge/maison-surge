"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, SITE_BUCKET } from "@/lib/images";
import { createClient } from "@/server/supabase/server";
import { createServiceClient } from "@/server/supabase/admin";
import { HEX_RE, SLUG_RE } from "@/features/admin/lib/helpers";
import { publicEnv } from "@/lib/env";
import { authorize, bool, dbFail, intField, isUuid, localized, optStr, revalidateStorefront, str, zodFail } from "./common";

const localizedReq = z.object({ tr: z.string().min(1, "Türkçe ad zorunludur.").max(200), en: z.string().max(200).optional() });
const localizedOpt = z.object({ tr: z.string().max(2000).optional(), en: z.string().max(2000).optional() });

// ---------------------------------------------------------------------------
// Site asset uploads (category/collection/homepage images) → public URL
// ---------------------------------------------------------------------------
const assetSchema = z.object({
  folder: z.enum(["categories", "collections", "homepage"]),
  type: z.enum(ALLOWED_IMAGE_TYPES, "Desteklenmeyen dosya türü (JPEG, PNG, WebP, AVIF)."),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES, "Dosya en fazla 8 MB olabilir."),
});
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

/**
 * Returns a signed upload URL for the public `site-assets` bucket. The stored
 * value is the full public URL so storefront code can render it regardless of
 * bucket (imageUrl() passes https URLs through).
 */
export async function createSiteAssetUpload(input: { folder: string; type: string; size: number }): Promise<ActionState<{ path: string; token: string; publicUrl: string }>> {
  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz dosya." };
  const auth = await authorize(parsed.data.folder === "homepage" ? "content.manage" : "catalog.manage");
  if (!auth.ok) return { ok: false, message: auth.state.message };
  const storage = createServiceClient().storage.from(SITE_BUCKET);
  const path = `${parsed.data.folder}/${randomUUID()}.${EXT[parsed.data.type]}`;
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: "Yükleme bağlantısı oluşturulamadı. Storage yapılandırmasını kontrol edin." };
  const publicUrl = `${publicEnv.supabaseUrl}/storage/v1/object/public/${SITE_BUCKET}/${data.path}`;
  return { ok: true, data: { path: data.path, token: data.token, publicUrl } };
}

function validImagePath(v: string | null): v is string | null {
  if (v === null) return true;
  return (v.startsWith("/") && !v.startsWith("//")) || v.startsWith(`${publicEnv.supabaseUrl}/storage/v1/object/public/`);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const categorySchema = z.object({
  slug: z.string().regex(SLUG_RE, "Slug yalnızca küçük harf, rakam ve tire içerebilir.").max(80),
  parent_id: z.uuid().nullable(),
  name: localizedReq,
  description: localizedOpt,
  seo_title: z.object({ tr: z.string().max(70, "En fazla 70 karakter.").optional(), en: z.string().max(70, "En fazla 70 karakter.").optional() }),
  seo_description: z.object({ tr: z.string().max(170, "En fazla 170 karakter.").optional(), en: z.string().max(170, "En fazla 170 karakter.").optional() }),
  image_path: z.string().max(500).nullable(),
  position: z.number().int().min(0).max(100000),
  is_active: z.boolean(),
});

function readCategoryLike(fd: FormData) {
  const pos = intField(fd, "position");
  return {
    slug: str(fd, "slug").toLowerCase(),
    name: localized(fd, "name"),
    description: localized(fd, "description"),
    image_path: optStr(fd, "image_path"),
    position: pos === undefined ? 0 : pos === null ? -1 : pos,
    is_active: bool(fd, "is_active"),
  };
}

export async function saveCategory(categoryId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (categoryId !== null && !isUuid(categoryId)) return { ok: false, message: "Geçersiz kategori." };
  const raw = { ...readCategoryLike(fd), parent_id: optStr(fd, "parent_id"), seo_title: localized(fd, "seo_title"), seo_description: localized(fd, "seo_description") };
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  if (!validImagePath(parsed.data.image_path)) return { ok: false, message: "Geçersiz görsel adresi." };
  const supabase = await createClient();
  if (categoryId && parsed.data.parent_id) {
    // Prevent cycles: the new parent must not be this category or one of its descendants.
    const { data: all } = await supabase.from("categories").select("id, parent_id");
    const children = new Map<string, string[]>();
    for (const c of all ?? []) if (c.parent_id) children.set(c.parent_id, [...(children.get(c.parent_id) ?? []), c.id]);
    const stack = [categoryId];
    const descendants = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (descendants.has(cur)) continue;
      descendants.add(cur);
      stack.push(...(children.get(cur) ?? []));
    }
    if (descendants.has(parsed.data.parent_id)) return { ok: false, message: "Bir kategori kendi alt kategorisinin altına taşınamaz.", errors: { parent_id: ["Geçersiz üst kategori."] } };
  }
  const { error, data } =
    categoryId === null
      ? await supabase.from("categories").insert(parsed.data).select("id").single()
      : await supabase.from("categories").update(parsed.data).eq("id", categoryId).select("id").single();
  if (error) return dbFail(error, "category save");
  revalidatePath("/admin/categories");
  revalidateStorefront();
  if (categoryId === null) redirect(`/admin/categories/${data.id}`);
  return { ok: true, message: "Kategori kaydedildi." };
}

export async function deleteCategory(categoryId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(categoryId)) return { ok: false, message: "Geçersiz kategori." };
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return dbFail(error, "category delete");
  revalidatePath("/admin/categories");
  revalidateStorefront();
  return { ok: true, message: "Kategori silindi. Bu kategorideki ürünler kategorisiz kaldı.", data: { redirect: "/admin/categories" } };
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
const collectionSchema = z.object({
  slug: z.string().regex(SLUG_RE, "Slug yalnızca küçük harf, rakam ve tire içerebilir.").max(80),
  name: localizedReq,
  description: localizedOpt,
  image_path: z.string().max(500).nullable(),
  position: z.number().int().min(0).max(100000),
  is_active: z.boolean(),
});

export async function saveCollection(collectionId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (collectionId !== null && !isUuid(collectionId)) return { ok: false, message: "Geçersiz koleksiyon." };
  const parsed = collectionSchema.safeParse(readCategoryLike(fd));
  if (!parsed.success) return zodFail(parsed.error);
  if (!validImagePath(parsed.data.image_path)) return { ok: false, message: "Geçersiz görsel adresi." };
  const supabase = await createClient();
  const { error, data } =
    collectionId === null
      ? await supabase.from("collections").insert(parsed.data).select("id").single()
      : await supabase.from("collections").update(parsed.data).eq("id", collectionId).select("id").single();
  if (error) return dbFail(error, "collection save");
  revalidatePath("/admin/collections");
  revalidateStorefront();
  if (collectionId === null) redirect(`/admin/collections/${data.id}`);
  return { ok: true, message: "Koleksiyon kaydedildi." };
}

export async function deleteCollection(collectionId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(collectionId)) return { ok: false, message: "Geçersiz koleksiyon." };
  const supabase = await createClient();
  const { error } = await supabase.from("collections").delete().eq("id", collectionId);
  if (error) return dbFail(error, "collection delete");
  revalidatePath("/admin/collections");
  revalidateStorefront();
  return { ok: true, message: "Koleksiyon silindi.", data: { redirect: "/admin/collections" } };
}

export async function addProductToCollection(collectionId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  const productId = str(fd, "product_id");
  if (!isUuid(collectionId) || !isUuid(productId)) return { ok: false, message: "Ürün seçin.", errors: { product_id: ["Ürün seçin."] } };
  const supabase = await createClient();
  const { data: last } = await supabase.from("collection_products").select("position").eq("collection_id", collectionId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("collection_products").insert({ collection_id: collectionId, product_id: productId, position: (last?.position ?? -1) + 1 });
  if (error) return error.code === "23505" ? { ok: false, message: "Ürün zaten bu koleksiyonda." } : dbFail(error, "collection add");
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidateStorefront();
  return { ok: true, message: "Ürün koleksiyona eklendi." };
}

export async function removeProductFromCollection(collectionId: string, productId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(collectionId) || !isUuid(productId)) return { ok: false, message: "Geçersiz kayıt." };
  const supabase = await createClient();
  const { error } = await supabase.from("collection_products").delete().eq("collection_id", collectionId).eq("product_id", productId);
  if (error) return dbFail(error, "collection remove");
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidateStorefront();
  return { ok: true, message: "Ürün koleksiyondan çıkarıldı." };
}

export async function moveCollectionProduct(collectionId: string, productId: string, dir: -1 | 1): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(collectionId) || !isUuid(productId) || (dir !== 1 && dir !== -1)) return { ok: false, message: "Geçersiz kayıt." };
  const supabase = await createClient();
  const { data } = await supabase.from("collection_products").select("product_id, position").eq("collection_id", collectionId).order("position").order("product_id");
  const list = [...(data ?? [])];
  const idx = list.findIndex((r) => r.product_id === productId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= list.length) return { ok: true };
  const [moved] = list.splice(idx, 1);
  list.splice(target, 0, moved!);
  for (let i = 0; i < list.length; i++) {
    if (list[i]!.position !== i) {
      const { error } = await supabase.from("collection_products").update({ position: i }).eq("collection_id", collectionId).eq("product_id", list[i]!.product_id);
      if (error) return dbFail(error, "collection reorder");
    }
  }
  revalidatePath(`/admin/collections/${collectionId}`);
  revalidateStorefront();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sizes & colours
// ---------------------------------------------------------------------------
const sizeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9-]{1,12}$/, "Kod büyük harf/rakam/tire, en fazla 12 karakter."),
  label: z.object({ tr: z.string().min(1, "Türkçe etiket zorunludur.").max(40), en: z.string().max(40).optional() }),
  position: z.number().int().min(0).max(100000),
});

export async function saveSize(sizeId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (sizeId !== null && !isUuid(sizeId)) return { ok: false, message: "Geçersiz beden." };
  const pos = intField(fd, "position");
  const code = str(fd, "code").toUpperCase();
  const label = localized(fd, "label");
  const parsed = sizeSchema.safeParse({ code, label: { tr: label.tr ?? code, en: label.en }, position: pos === undefined ? 0 : pos === null ? -1 : pos });
  if (!parsed.success) return zodFail(parsed.error);
  const row = { ...parsed.data, label: Object.fromEntries(Object.entries(parsed.data.label).filter(([, v]) => v)) };
  const supabase = await createClient();
  const { error } = sizeId === null ? await supabase.from("sizes").insert(row) : await supabase.from("sizes").update(row).eq("id", sizeId);
  if (error) return dbFail(error, "size save");
  revalidatePath("/admin/attributes");
  revalidateStorefront();
  return { ok: true, message: "Beden kaydedildi." };
}

export async function deleteSize(sizeId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(sizeId)) return { ok: false, message: "Geçersiz beden." };
  const supabase = await createClient();
  const { error } = await supabase.from("sizes").delete().eq("id", sizeId);
  if (error) return error.code === "23503" ? { ok: false, message: "Bu beden varyantlarda kullanılıyor; önce ilgili varyantları değiştirin." } : dbFail(error, "size delete");
  revalidatePath("/admin/attributes");
  return { ok: true, message: "Beden silindi." };
}

const colorSchema = z.object({
  code: z.string().regex(SLUG_RE, "Kod küçük harf, rakam ve tire içermeli.").max(40),
  name: z.object({ tr: z.string().min(1, "Türkçe ad zorunludur.").max(40), en: z.string().max(40).optional() }),
  hex: z.string().regex(HEX_RE, "Renk kodu #RRGGBB biçiminde olmalı."),
  position: z.number().int().min(0).max(100000),
});

export async function saveColor(colorId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (colorId !== null && !isUuid(colorId)) return { ok: false, message: "Geçersiz renk." };
  const pos = intField(fd, "position");
  const name = localized(fd, "name");
  const parsed = colorSchema.safeParse({ code: str(fd, "code").toLowerCase(), name: { tr: name.tr ?? "", en: name.en }, hex: str(fd, "hex").toUpperCase(), position: pos === undefined ? 0 : pos === null ? -1 : pos });
  if (!parsed.success) return zodFail(parsed.error);
  const row = { ...parsed.data, name: Object.fromEntries(Object.entries(parsed.data.name).filter(([, v]) => v)) };
  const supabase = await createClient();
  const { error } = colorId === null ? await supabase.from("colors").insert(row) : await supabase.from("colors").update(row).eq("id", colorId);
  if (error) return dbFail(error, "color save");
  revalidatePath("/admin/attributes");
  revalidateStorefront();
  return { ok: true, message: "Renk kaydedildi." };
}

export async function deleteColor(colorId: string): Promise<ActionState> {
  const auth = await authorize("catalog.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(colorId)) return { ok: false, message: "Geçersiz renk." };
  const supabase = await createClient();
  const { error } = await supabase.from("colors").delete().eq("id", colorId);
  if (error) return error.code === "23503" ? { ok: false, message: "Bu renk varyantlarda kullanılıyor; önce ilgili varyantları değiştirin." } : dbFail(error, "color delete");
  revalidatePath("/admin/attributes");
  return { ok: true, message: "Renk silindi." };
}
