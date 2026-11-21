import "server-only";
import { createClient } from "@/server/supabase/server";
import { pickLocale } from "@/lib/utils";
import type { Tables } from "@/types/database.types";
import type { SectionType, SectionValues } from "./section-form";

type L = { tr?: string; en?: string };

export async function loadSectionOptions() {
  const supabase = await createClient();
  const [{ data: cats }, { data: cols }] = await Promise.all([
    supabase.from("categories").select("id, name").order("position"),
    supabase.from("collections").select("id, name").order("position"),
  ]);
  return {
    categories: (cats ?? []).map((c) => ({ id: c.id, label: pickLocale(c.name, "tr") })),
    collections: (cols ?? []).map((c) => ({ id: c.id, label: pickLocale(c.name, "tr") })),
  };
}

export function toSectionValues(s: Tables<"homepage_sections">): SectionValues {
  const cfg = (s.config && typeof s.config === "object" && !Array.isArray(s.config) ? s.config : {}) as Record<string, unknown>;
  return {
    type: s.type as SectionType,
    title: s.title as L,
    subtitle: s.subtitle as L,
    body: s.body as L,
    cta_label: s.cta_label as L,
    cta_href: s.cta_href,
    image_path: s.image_path,
    image_alt: s.image_alt as L,
    is_active: s.is_active,
    config: {
      source: typeof cfg.source === "string" ? cfg.source : undefined,
      limit: typeof cfg.limit === "number" ? cfg.limit : undefined,
      collection_id: typeof cfg.collection_id === "string" ? cfg.collection_id : undefined,
      category_ids: Array.isArray(cfg.category_ids) ? cfg.category_ids.filter((x): x is string => typeof x === "string") : undefined,
    },
  };
}
