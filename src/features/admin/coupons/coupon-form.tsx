"use client";

import { useState } from "react";
import { toInputValue } from "@/lib/money";
import { isoToIstanbulLocal } from "@/features/admin/lib/helpers";
import { ActionForm, CheckboxField, FormSection, FormSubmit, MoneyField, SelectField, TextField, type FormAction } from "@/features/admin/ui/action-form";

export type CouponValues = {
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  is_active: boolean;
};

export function CouponForm({ action, values }: { action: FormAction; values: CouponValues | null }) {
  const [type, setType] = useState<"percent" | "fixed">(values?.type ?? "percent");
  return (
    <ActionForm action={action} className="grid gap-6">
      <FormSection title="Kupon">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="code" label="Kod *" defaultValue={values?.code ?? ""} maxLength={40} required className="uppercase" hint="Müşterinin gireceği kod; büyük harfe çevrilir." />
          <TextField name="description" label="İç açıklama" defaultValue={values?.description ?? ""} maxLength={300} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            name="type"
            label="İndirim türü"
            value={type}
            onChange={(e) => setType(e.currentTarget.value === "fixed" ? "fixed" : "percent")}
            options={[
              { value: "percent", label: "Yüzde (%)" },
              { value: "fixed", label: "Sabit tutar (₺)" },
            ]}
          />
          {type === "percent" ? (
            <TextField key="pct" name="value" label="İndirim yüzdesi *" type="number" min={1} max={100} defaultValue={values?.type === "percent" ? String(values.value) : ""} hint="1–100" />
          ) : (
            <MoneyField key="fix" name="value" label="İndirim tutarı *" defaultValue={values?.type === "fixed" ? toInputValue(values.value) : ""} />
          )}
          <MoneyField name="max_discount" label="Azami indirim" defaultValue={toInputValue(values?.max_discount)} hint="Yüzde indirimlerde tavan (isteğe bağlı)." />
        </div>
        <MoneyField name="min_subtotal" label="Asgari sepet tutarı" defaultValue={toInputValue(values?.min_subtotal ?? 0)} />
      </FormSection>
      <FormSection title="Geçerlilik ve limitler" description="Tarihler İstanbul saatiyle (UTC+3) yorumlanır. Boş bırakılan alan sınırsız demektir.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="starts_at" label="Başlangıç" type="datetime-local" defaultValue={isoToIstanbulLocal(values?.starts_at)} />
          <TextField name="ends_at" label="Bitiş" type="datetime-local" defaultValue={isoToIstanbulLocal(values?.ends_at)} />
          <TextField name="usage_limit" label="Toplam kullanım limiti" type="number" min={1} defaultValue={values?.usage_limit?.toString() ?? ""} />
          <TextField name="per_customer_limit" label="Müşteri başına limit" type="number" min={1} defaultValue={values?.per_customer_limit?.toString() ?? ""} hint="E-posta veya hesaba göre." />
        </div>
        <CheckboxField name="is_active" label="Aktif" defaultChecked={values?.is_active ?? true} />
      </FormSection>
      <div className="flex justify-end">
        <FormSubmit>{values ? "Kaydet" : "Kupon oluştur"}</FormSubmit>
      </div>
    </ActionForm>
  );
}
