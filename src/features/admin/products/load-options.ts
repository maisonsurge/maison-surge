import "server-only";
import { createClient } from "@/server/supabase/server";
import { pickLocale } from "@/lib/utils";

/** Option lists shared by product forms. */
export async function loadCatalogOptions() {
  const supabase = await createClient();
  const [cats, cols, sizes, colors] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id, position").order("position"),
    supabase.from("collections").select("id, name").order("position"),
    supabase.from("sizes").select("id, code, label").order("position"),
    supabase.from("colors").select("id, code, name, hex").order("position"),
  ]);
  const catRows = cats.data ?? [];
  const byId = new Map(catRows.map((c) => [c.id, c]));
  const catLabel = (c: (typeof catRows)[number]) => {
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
    return parent ? `${pickLocale(parent.name, "tr")} › ${pickLocale(c.name, "tr")}` : pickLocale(c.name, "tr");
  };
  return {
    categories: catRows.map((c) => ({ id: c.id, label: catLabel(c) })),
    collections: (cols.data ?? []).map((c) => ({ id: c.id, label: pickLocale(c.name, "tr") })),
    sizes: (sizes.data ?? []).map((s) => ({ id: s.id, label: pickLocale(s.label, "tr") || s.code })),
    colors: (colors.data ?? []).map((c) => ({ id: c.id, label: pickLocale(c.name, "tr") || c.code, hex: c.hex })),
  };
}
