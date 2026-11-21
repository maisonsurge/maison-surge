"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import type { Json } from "@/types/database.types";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/server/supabase/server";
import { CTA_HREF_RE, SLUG_RE } from "@/features/admin/lib/helpers";
import { authorize, bool, dbFail, intField, isUuid, localized, optStr, revalidateStorefront, str, strs, zodFail } from "./common";

const SECTION_TYPES = ["hero", "category_grid", "product_rail", "editorial", "newsletter"] as const;
const loc = (max: number) => z.object({ tr: z.string().max(max).optional(), en: z.string().max(max).optional() });

const sectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  title: loc(160),
  subtitle: loc(160),
  body: loc(2000),
  cta_label: loc(60),
  cta_href: z.string().regex(CTA_HREF_RE, "Bağlantı / ile başlayan site içi bir yol olmalı (örn. /shop).").max(300).nullable(),
  image_path: z.string().max(500).nullable(),
  image_alt: loc(200),
  is_active: z.boolean(),
});

function readConfig(type: string, fd: FormData): { config: Json } | { error: string } {
  if (type === "product_rail") {
    const source = str(fd, "config_source") || "new";
    if (!["new", "featured", "collection"].includes(source)) return { error: "Geçersiz ürün kaynağı." };
    const limit = intField(fd, "config_limit") ?? 8;
    if (limit === null || limit < 4 || limit > 12) return { error: "Ürün sayısı 4–12 arasında olmalı." };
    const collectionId = optStr(fd, "config_collection_id");
    if (source === "collection" && !isUuid(collectionId)) return { error: "Koleksiyon kaynağı için koleksiyon seçin." };
    return { config: { source, limit, ...(source === "collection" ? { collection_id: collectionId } : {}) } };
  }
  if (type === "category_grid") {
    const ids = strs(fd, "config_category_ids").filter(isUuid);
    return { config: { category_ids: ids } };
  }
  return { config: {} };
}

function validImage(v: string | null) {
  return v === null || (v.startsWith("/") && !v.startsWith("//")) || v.startsWith(`${publicEnv.supabaseUrl}/storage/v1/object/public/`);
}

export async function saveHomepageSection(sectionId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("content.manage");
  if (!auth.ok) return auth.state;
  if (sectionId !== null && !isUuid(sectionId)) return { ok: false, message: "Geçersiz blok." };
  const parsed = sectionSchema.safeParse({
    type: str(fd, "type"),
    title: localized(fd, "title"),
    subtitle: localized(fd, "subtitle"),
    body: localized(fd, "body"),
    cta_label: localized(fd, "cta_label"),
    cta_href: optStr(fd, "cta_href"),
    image_path: optStr(fd, "image_path"),
    image_alt: localized(fd, "image_alt"),
    is_active: bool(fd, "is_active"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  if (!validImage(parsed.data.image_path)) return { ok: false, message: "Geçersiz görsel adresi." };
  const cfg = readConfig(parsed.data.type, fd);
  if ("error" in cfg) return { ok: false, message: cfg.error };
  const supabase = await createClient();
  let newId: string | null = null;
  if (sectionId === null) {
    const { data: last } = await supabase.from("homepage_sections").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase
      .from("homepage_sections")
      .insert({ ...parsed.data, config: cfg.config, position: (last?.position ?? 0) + 10 })
      .select("id")
      .single();
    if (error) return dbFail(error, "section insert");
    newId = data.id;
  } else {
    const { error } = await supabase.from("homepage_sections").update({ ...parsed.data, config: cfg.config }).eq("id", sectionId);
    if (error) return dbFail(error, "section update");
  }
  revalidatePath("/admin/homepage");
  revalidateStorefront();
  if (newId) redirect(`/admin/homepage/${newId}?created=1`);
  return { ok: true, message: "Blok kaydedildi." };
}

export async function moveHomepageSection(sectionId: string, dir: -1 | 1): Promise<ActionState> {
  const auth = await authorize("content.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(sectionId) || (dir !== 1 && dir !== -1)) return { ok: false, message: "Geçersiz blok." };
  const supabase = await createClient();
  const { data } = await supabase.from("homepage_sections").select("id, position, created_at").order("position").order("created_at");
  const list = [...(data ?? [])];
  const idx = list.findIndex((s) => s.id === sectionId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= list.length) return { ok: true };
  const [moved] = list.splice(idx, 1);
  list.splice(target, 0, moved!);
  for (let i = 0; i < list.length; i++) {
    const pos = (i + 1) * 10;
    if (list[i]!.position !== pos) {
      const { error } = await supabase.from("homepage_sections").update({ position: pos }).eq("id", list[i]!.id);
      if (error) return dbFail(error, "section reorder");
    }
  }
  revalidatePath("/admin/homepage");
  revalidateStorefront();
  return { ok: true };
}

export async function toggleHomepageSection(sectionId: string, active: boolean): Promise<ActionState> {
  const auth = await authorize("content.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(sectionId)) return { ok: false, message: "Geçersiz blok." };
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_sections").update({ is_active: active }).eq("id", sectionId);
  if (error) return dbFail(error, "section toggle");
  revalidatePath("/admin/homepage");
  revalidateStorefront();
  return { ok: true, message: active ? "Blok yayında." : "Blok gizlendi." };
}

export async function deleteHomepageSection(sectionId: string): Promise<ActionState> {
  const auth = await authorize("content.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(sectionId)) return { ok: false, message: "Geçersiz blok." };
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_sections").delete().eq("id", sectionId);
  if (error) return dbFail(error, "section delete");
  revalidatePath("/admin/homepage");
  revalidateStorefront();
  return { ok: true, message: "Blok silindi.", data: { redirect: "/admin/homepage" } };
}

// ---------------------------------------------------------------------------
// Content pages
// ---------------------------------------------------------------------------
const pageSchema = z.object({
  slug: z.string().regex(SLUG_RE, "Slug yalnızca küçük harf, rakam ve tire içerebilir.").max(80),
  title: z.object({ tr: z.string().min(1, "Türkçe başlık zorunludur.").max(160), en: z.string().max(160).optional() }),
  body: z.object({ tr: z.string().max(60000).optional(), en: z.string().max(60000).optional() }),
  is_published: z.boolean(),
  needs_legal_review: z.boolean(),
  position: z.number().int().min(0).max(100000),
});

export async function saveContentPage(pageId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("content.manage");
  if (!auth.ok) return auth.state;
  if (pageId !== null && !isUuid(pageId)) return { ok: false, message: "Geçersiz sayfa." };
  const title = localized(fd, "title");
  const pos = intField(fd, "position");
  // Markdown bodies keep their whitespace; read raw values.
  const rawBody = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() ? v.replace(/\r\n/g, "\n") : undefined;
  };
  const parsed = pageSchema.safeParse({
    slug: str(fd, "slug").toLowerCase(),
    title: { tr: title.tr ?? "", en: title.en },
    body: { tr: rawBody("body_tr"), en: rawBody("body_en") },
    is_published: bool(fd, "is_published"),
    needs_legal_review: bool(fd, "needs_legal_review"),
    position: pos === undefined ? 0 : pos === null ? -1 : pos,
  });
  if (!parsed.success) return zodFail(parsed.error);
  const clean = (o: { tr?: string; en?: string }) => Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as { tr?: string; en?: string };
  const row = { ...parsed.data, title: clean(parsed.data.title), body: clean(parsed.data.body) };
  const supabase = await createClient();
  const { data, error } =
    pageId === null ? await supabase.from("content_pages").insert(row).select("id").single() : await supabase.from("content_pages").update(row).eq("id", pageId).select("id").single();
  if (error) return error.code === "23505" ? { ok: false, message: "Bu slug zaten kullanılıyor.", errors: { slug: ["Slug kullanımda."] } } : dbFail(error, "page save");
  revalidatePath("/admin/pages");
  revalidateStorefront();
  if (pageId === null) redirect(`/admin/pages/${data.id}?created=1`);
  return { ok: true, message: "Sayfa kaydedildi." };
}

export async function deleteContentPage(pageId: string): Promise<ActionState> {
  const auth = await authorize("content.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(pageId)) return { ok: false, message: "Geçersiz sayfa." };
  const supabase = await createClient();
  const { error } = await supabase.from("content_pages").delete().eq("id", pageId);
  if (error) return dbFail(error, "page delete");
  revalidatePath("/admin/pages");
  revalidateStorefront();
  return { ok: true, message: "Sayfa silindi.", data: { redirect: "/admin/pages" } };
}
