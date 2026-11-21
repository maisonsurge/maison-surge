"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { formatMoney, toInputValue } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { ActionForm, CheckboxField, FormSubmit, MoneyField, SelectField, TextField } from "@/features/admin/ui/action-form";
import { ActionButton } from "@/features/admin/ui/action-button";
import { deleteVariant, saveVariant, setVariantStock } from "@/server/admin/products";

export type VariantRow = {
  id: string;
  sku: string;
  size_id: string | null;
  color_id: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock_on_hand: number;
  stock_reserved: number;
  low_stock_threshold: number;
  is_active: boolean;
  position: number;
};

type Opt = { id: string; label: string; hex?: string };

function VariantFields({ v, sizes, colors, isNew }: { v?: VariantRow; sizes: Opt[]; colors: Opt[]; isNew: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <TextField name="sku" label="SKU *" defaultValue={v?.sku ?? ""} required maxLength={48} className="uppercase" hint="Büyük harf, rakam, tire" />
      <SelectField name="size_id" label="Beden" defaultValue={v?.size_id ?? ""} placeholder="— Yok —" options={sizes.map((s) => ({ value: s.id, label: s.label }))} />
      <SelectField name="color_id" label="Renk" defaultValue={v?.color_id ?? ""} placeholder="— Yok —" options={colors.map((c) => ({ value: c.id, label: c.label }))} />
      <TextField name="position" label="Sıra" type="number" min={0} defaultValue={String(v?.position ?? 0)} />
      <MoneyField name="price" label="Fiyat (boş = ürün fiyatı)" defaultValue={toInputValue(v?.price)} hint=" " />
      <MoneyField name="compare_at_price" label="Karşılaştırma fiyatı" defaultValue={toInputValue(v?.compare_at_price)} hint=" " />
      <TextField name="low_stock_threshold" label="Az stok eşiği" type="number" min={0} defaultValue={String(v?.low_stock_threshold ?? 3)} />
      {isNew ? <TextField name="stock_on_hand" label="Başlangıç stoğu" type="number" min={0} defaultValue="0" /> : <div />}
      <div className="sm:col-span-2 lg:col-span-4">
        <CheckboxField name="is_active" label="Satışta (aktif)" defaultChecked={v?.is_active ?? true} />
      </div>
    </div>
  );
}

export function VariantsEditor({ productId, basePrice, variants, sizes, colors }: { productId: string; basePrice: number; variants: VariantRow[]; sizes: Opt[]; colors: Opt[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(variants.length === 0);
  const sizeLabel = (id: string | null) => sizes.find((s) => s.id === id)?.label ?? "—";
  const color = (id: string | null) => colors.find((c) => c.id === id);

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-sm border border-line" role="region" aria-label="Varyantlar" tabIndex={0}>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-sand-50 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">SKU</th>
              <th className="px-3 py-2 font-semibold">Beden / Renk</th>
              <th className="px-3 py-2 text-right font-semibold">Fiyat</th>
              <th className="px-3 py-2 text-right font-semibold">Stok / Rezerve / Kullanılabilir</th>
              <th className="px-3 py-2 font-semibold">Durum</th>
              <th className="px-3 py-2 font-semibold">
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  Henüz varyant yok. Ürünün satılabilmesi için en az bir aktif varyant gerekir.
                </td>
              </tr>
            ) : null}
            {variants.map((v) => {
              const c = color(v.color_id);
              const available = v.stock_on_hand - v.stock_reserved;
              return (
                <tr key={v.id} className="border-t border-line align-top">
                  <td className="px-3 py-2.5 font-mono text-xs">{v.sku}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      {sizeLabel(v.size_id)} /
                      {c ? <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-line" style={{ backgroundColor: c.hex }} /> : null}
                      {c?.label ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(v.price ?? basePrice)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${available <= v.low_stock_threshold ? "text-burgundy" : ""}`}>
                    {v.stock_on_hand} / {v.stock_reserved} / <strong>{available}</strong>
                  </td>
                  <td className="px-3 py-2.5">{v.is_active ? <Badge tone="success">Aktif</Badge> : <Badge>Pasif</Badge>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(editing === v.id ? null : v.id)} aria-expanded={editing === v.id}>
                        {editing === v.id ? "Kapat" : "Düzenle"}
                      </Button>
                      <ActionButton
                        action={deleteVariant.bind(null, productId, v.id)}
                        variant="ghost"
                        confirm={{ title: `${v.sku} silinsin mi?`, body: "Geçmiş siparişler korunur. Aktif rezervasyonu olan varyant silinemez.", confirmLabel: "Sil" }}
                      >
                        Sil
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {variants
        .filter((v) => v.id === editing)
        .map((v) => (
          <div key={v.id} className="grid gap-4 rounded-sm border border-ink/30 bg-sand-50 p-4">
            <h3 className="text-sm font-semibold">Varyantı düzenle: {v.sku}</h3>
            <ActionForm action={saveVariant.bind(null, productId, v.id)} className="grid gap-4">
              <VariantFields v={v} sizes={sizes} colors={colors} isNew={false} />
              <div className="flex justify-end">
                <FormSubmit size="sm">Varyantı kaydet</FormSubmit>
              </div>
            </ActionForm>
            <ActionForm action={setVariantStock.bind(null, v.id)} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <TextField name="on_hand" label="Eldeki stok" type="number" min={v.stock_reserved} defaultValue={String(v.stock_on_hand)} />
              <TextField name="reason" label="Gerekçe *" placeholder="örn. sayım, yeni sevkiyat" maxLength={500} />
              <FormSubmit size="sm" variant="secondary">
                Stoğu güncelle
              </FormSubmit>
              <p className="text-xs text-muted sm:col-span-3">
                Stok değişiklikleri stok hareketleri kaydına yazılır. Rezerve adet ({v.stock_reserved}) altına düşürülemez.
              </p>
            </ActionForm>
          </div>
        ))}

      {adding ? (
        <div className="rounded-sm border border-line bg-sand-50 p-4">
          <h3 className="mb-3 text-sm font-semibold">Yeni varyant</h3>
          <ActionForm action={saveVariant.bind(null, productId, null)} className="grid gap-4" resetOnSuccess successMessage="Varyant eklendi.">
            <VariantFields sizes={sizes} colors={colors} isNew />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Vazgeç
              </Button>
              <FormSubmit size="sm">Varyant ekle</FormSubmit>
            </div>
          </ActionForm>
        </div>
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Varyant ekle
          </Button>
        </div>
      )}
    </div>
  );
}
