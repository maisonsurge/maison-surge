"use client";

import { useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Label, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { ActionForm, CheckboxField, FormSection, FormSubmit, LocalizedFields, TextField, useFormCtx, type FormAction } from "@/features/admin/ui/action-form";

type L = { tr?: string; en?: string };
export type PageValues = { slug: string; title: L; body: L; is_published: boolean; needs_legal_review: boolean; position: number };

/** Markdown textarea with an accessible Edit / Preview tab pair. Raw HTML is never rendered. */
function MarkdownEditor({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const id = useId();
  const { state } = useFormCtx();
  const error = state.ok ? undefined : state.errors?.[name]?.[0];
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-ta`} className="mb-0">
          {label}
        </Label>
        <div role="tablist" aria-label={`${label} görünümü`} className="flex text-xs">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`${id}-${t}`}
              onClick={() => setTab(t)}
              className={cn("border-b-2 px-3 py-1", tab === t ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink")}
            >
              {t === "edit" ? "Düzenle" : "Önizleme"}
            </button>
          ))}
        </div>
      </div>
      <div id={`${id}-edit`} role="tabpanel" hidden={tab !== "edit"}>
        <Textarea id={`${id}-ta`} name={name} value={value} onChange={(e) => setValue(e.currentTarget.value)} rows={18} className="font-mono text-xs leading-relaxed" aria-invalid={Boolean(error)} />
      </div>
      {/* The textarea stays mounted (only hidden) so its value is submitted from either tab. */}
      <div id={`${id}-preview`} role="tabpanel" hidden={tab !== "preview"} className="min-h-40 rounded-sm border border-line bg-paper p-4">
        {value.trim() ? (
          <div className="prose-ms">
            <ReactMarkdown skipHtml>{value}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted">İçerik yok.</p>
        )}
      </div>
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
      <p className="mt-1.5 text-xs text-muted">Markdown: ## başlık, **kalın**, - liste, [bağlantı](/tr/pages/sss), | tablo |. HTML etiketleri gösterilmez.</p>
    </div>
  );
}

export function PageForm({ action, values }: { action: FormAction; values: PageValues | null }) {
  return (
    <ActionForm action={action} className="grid gap-6">
      <FormSection title="Sayfa">
        <div className="grid gap-4 md:grid-cols-[1fr_8rem]">
          <TextField name="slug" label="URL (slug) *" defaultValue={values?.slug ?? ""} maxLength={80} required hint={values ? `Adres: /tr/pages/${values.slug}` : "örn. kargo-bilgileri"} />
          <TextField name="position" label="Sıra" type="number" min={0} defaultValue={String(values?.position ?? 0)} />
        </div>
        <LocalizedFields base="title" label="Başlık" values={values?.title} requireTr maxLength={160} />
        <div className="flex flex-wrap gap-6">
          <CheckboxField name="is_published" label="Yayında" defaultChecked={values?.is_published ?? true} />
          <CheckboxField name="needs_legal_review" label="Hukuki onay bekliyor (sayfada “taslak” uyarısı gösterilir)" defaultChecked={values?.needs_legal_review ?? true} />
        </div>
      </FormSection>
      <FormSection title="İçerik (TR)">
        <MarkdownEditor name="body_tr" label="Metin (TR)" defaultValue={values?.body.tr ?? ""} />
      </FormSection>
      <FormSection title="İçerik (EN)" description="Boş bırakılırsa İngilizce sitede Türkçe metin gösterilir.">
        <MarkdownEditor name="body_en" label="Text (EN)" defaultValue={values?.body.en ?? ""} />
      </FormSection>
      <div className="flex justify-end">
        <FormSubmit>{values ? "Kaydet" : "Sayfa oluştur"}</FormSubmit>
      </div>
    </ActionForm>
  );
}
