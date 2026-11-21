"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Textarea, Input, Label } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { initialActionState } from "@/lib/action-state";
import { importStockCsv } from "@/server/admin/inventory";

export function StockImport() {
  const [state, action, pending] = useActionState(importStockCsv, initialActionState);
  const toast = useToast();
  const router = useRouter();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (state.message) toast(state.message, state.ok ? "success" : "error");
    if (state.ok) router.refresh();
  }, [state, toast, router]);
  const report = (state.data as { report?: { line: number; sku: string; ok: boolean; message: string }[] } | undefined)?.report;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <div>
        <Label htmlFor="csv">CSV (sku,stok — her satıra bir varyant)</Label>
        <Textarea id="csv" name="csv" rows={5} className="font-mono text-xs" placeholder={"sku,stok\nDABC123-KUM-M,12\nDABC123-KUM-L,0"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="csv-file">veya dosya seçin (.csv, en fazla 512 KB)</Label>
          <Input id="csv-file" name="file" type="file" accept=".csv,text/csv,text/plain" className="py-2" />
        </div>
        <div>
          <Label htmlFor="csv-reason">Gerekçe</Label>
          <Input id="csv-reason" name="reason" placeholder="örn. Aralık sayımı" maxLength={200} />
        </div>
      </div>
      <p className="text-xs text-muted">Değer, eldeki stoğun yeni toplamıdır (fark değil). Rezerve adetin altına inen satırlar reddedilir. Her değişiklik stok hareketlerine yazılır.</p>
      <div>
        <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
          {pending ? "İçe aktarılıyor…" : "Stokları içe aktar"}
        </Button>
      </div>
      {report && report.length ? (
        <div className="max-h-64 overflow-y-auto rounded-sm border border-line text-xs" aria-live="polite">
          <table className="w-full">
            <thead className="bg-sand-50 text-left">
              <tr>
                <th className="px-2 py-1">Satır</th>
                <th className="px-2 py-1">SKU</th>
                <th className="px-2 py-1">Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={`${r.line}-${r.sku}`} className="border-t border-line">
                  <td className="px-2 py-1 tabular-nums">{r.line}</td>
                  <td className="px-2 py-1 font-mono">{r.sku}</td>
                  <td className={`px-2 py-1 ${r.ok ? "text-olive" : "text-burgundy"}`}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </form>
  );
}
