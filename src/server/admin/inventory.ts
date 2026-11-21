"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/server/supabase/server";
import { parseStockCsv } from "@/features/admin/lib/helpers";
import { authorize, errorMessage, revalidateStorefront, str } from "./common";
import { dbErrorCode } from "@/lib/action-state";

export type ImportReport = { line: number; sku: string; ok: boolean; message: string }[];

/** Bulk stock update from "sku,stock" lines. Each line goes through admin_set_variant_stock (logged). */
export async function importStockCsv(_prev: ActionState, fd: FormData): Promise<ActionState<{ report: ImportReport }>> {
  const auth = await authorize("inventory.manage");
  if (!auth.ok) return { ok: false, message: auth.state.message };
  const file = fd.get("file");
  let text = str(fd, "csv");
  if (!text && file instanceof File && file.size > 0) {
    if (file.size > 512 * 1024) return { ok: false, message: "Dosya en fazla 512 KB olabilir." };
    text = await file.text();
  }
  if (!text) return { ok: false, message: "CSV içeriği girin veya dosya seçin.", errors: { csv: ["CSV boş."] } };
  const reason = str(fd, "reason") || "CSV stok içe aktarma";
  const lines = parseStockCsv(text);
  if (lines.length === 0) return { ok: false, message: "Geçerli satır bulunamadı." };
  if (lines.length > 1000) return { ok: false, message: "Tek seferde en fazla 1000 satır." };

  const supabase = await createClient();
  const skus = lines.flatMap((l) => ("sku" in l ? [l.sku] : []));
  const { data: variants } = skus.length ? await supabase.from("product_variants").select("id, sku").in("sku", skus) : { data: [] };
  const bySku = new Map((variants ?? []).map((v) => [v.sku, v.id]));

  const report: ImportReport = [];
  for (const l of lines) {
    if ("error" in l) {
      report.push({ line: l.line, sku: l.raw, ok: false, message: l.error });
      continue;
    }
    const id = bySku.get(l.sku);
    if (!id) {
      report.push({ line: l.line, sku: l.sku, ok: false, message: "SKU bulunamadı" });
      continue;
    }
    const { error } = await supabase.rpc("admin_set_variant_stock", { p_variant_id: id, p_on_hand: l.stock, p_reason: reason.slice(0, 500) });
    report.push({ line: l.line, sku: l.sku, ok: !error, message: error ? errorMessage(dbErrorCode(error)) : `Stok ${l.stock}` });
  }
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products", "layout");
  revalidateStorefront();
  const okCount = report.filter((r) => r.ok).length;
  return { ok: okCount > 0, message: `${okCount}/${report.length} satır güncellendi.`, data: { report } };
}
