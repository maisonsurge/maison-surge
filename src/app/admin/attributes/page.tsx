import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteColor, deleteSize, saveColor, saveSize } from "@/server/admin/catalog";
import { Card, PageHeader } from "@/features/admin/ui/primitives";
import { ActionForm, FormSubmit, TextField } from "@/features/admin/ui/action-form";
import { ActionButton } from "@/features/admin/ui/action-button";

export const metadata = { title: "Beden & Renk" };
type L = { tr?: string; en?: string };

function SizeFields({ v }: { v?: { code: string; label: L; position: number } }) {
  return (
    <>
      <TextField name="code" label="Kod *" defaultValue={v?.code ?? ""} maxLength={12} required hint="örn. M, XL, 42" />
      <TextField name="label_tr" label="Etiket (TR)" defaultValue={v?.label.tr ?? ""} maxLength={40} />
      <TextField name="label_en" label="Etiket (EN)" defaultValue={v?.label.en ?? ""} maxLength={40} />
      <TextField name="position" label="Sıra" type="number" min={0} defaultValue={String(v?.position ?? 0)} />
    </>
  );
}

function ColorFields({ v }: { v?: { code: string; name: L; hex: string; position: number } }) {
  return (
    <>
      <TextField name="code" label="Kod *" defaultValue={v?.code ?? ""} maxLength={40} required hint="örn. kum, koyu-lacivert" />
      <TextField name="name_tr" label="Ad (TR) *" defaultValue={v?.name.tr ?? ""} maxLength={40} required />
      <TextField name="name_en" label="Ad (EN)" defaultValue={v?.name.en ?? ""} maxLength={40} />
      <TextField name="hex" label="Renk *" type="color" defaultValue={v?.hex ?? "#E5DECF"} className="[&_input]:h-11 [&_input]:p-1" />
      <TextField name="position" label="Sıra" type="number" min={0} defaultValue={String(v?.position ?? 0)} />
    </>
  );
}

export default async function AttributesPage() {
  await requireStaff("catalog.manage");
  const supabase = await createClient();
  const [{ data: sizes }, { data: colors }] = await Promise.all([
    supabase.from("sizes").select("*").order("position"),
    supabase.from("colors").select("*").order("position"),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Beden & Renk sözlükleri" description="Varyantlarda kullanılan bedenler ve renkler. Kullanımdaki bir değer silinemez." />

      <Card title={`Bedenler (${(sizes ?? []).length})`}>
        <div className="grid gap-3">
          {(sizes ?? []).map((s) => (
            <div key={s.id} className="rounded-sm border border-line p-3">
              <ActionForm action={saveSize.bind(null, s.id)} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[8rem_1fr_1fr_6rem_auto]" showErrorSummary={false}>
                <SizeFields v={{ code: s.code, label: s.label as L, position: s.position }} />
                <div className="flex gap-2 pb-0.5">
                  <FormSubmit size="sm" variant="outline">
                    Kaydet
                  </FormSubmit>
                  <ActionButton action={deleteSize.bind(null, s.id)} variant="ghost" confirm={{ title: `${s.code} bedeni silinsin mi?`, confirmLabel: "Sil" }}>
                    Sil
                  </ActionButton>
                </div>
              </ActionForm>
            </div>
          ))}
          <div className="rounded-sm border border-dashed border-line bg-sand-50 p-3">
            <p className="mb-2 text-xs font-semibold">Yeni beden</p>
            <ActionForm action={saveSize.bind(null, null)} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[8rem_1fr_1fr_6rem_auto]" successMessage="Beden eklendi.">
              <SizeFields />
              <FormSubmit size="sm">Ekle</FormSubmit>
            </ActionForm>
          </div>
        </div>
      </Card>

      <Card title={`Renkler (${(colors ?? []).length})`} className="mt-6">
        <div className="grid gap-3">
          {(colors ?? []).map((c) => (
            <div key={c.id} className="rounded-sm border border-line p-3">
              <ActionForm action={saveColor.bind(null, c.id)} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_1fr_1fr_5rem_5rem_auto]" showErrorSummary={false}>
                <ColorFields v={{ code: c.code, name: c.name as L, hex: c.hex, position: c.position }} />
                <div className="flex gap-2 pb-0.5">
                  <FormSubmit size="sm" variant="outline">
                    Kaydet
                  </FormSubmit>
                  <ActionButton action={deleteColor.bind(null, c.id)} variant="ghost" confirm={{ title: `“${(c.name as L).tr ?? c.code}” rengi silinsin mi?`, confirmLabel: "Sil" }}>
                    Sil
                  </ActionButton>
                </div>
              </ActionForm>
            </div>
          ))}
          <div className="rounded-sm border border-dashed border-line bg-sand-50 p-3">
            <p className="mb-2 text-xs font-semibold">Yeni renk</p>
            <ActionForm action={saveColor.bind(null, null)} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_1fr_1fr_5rem_5rem_auto]" successMessage="Renk eklendi.">
              <ColorFields />
              <FormSubmit size="sm">Ekle</FormSubmit>
            </ActionForm>
          </div>
        </div>
      </Card>
    </div>
  );
}
