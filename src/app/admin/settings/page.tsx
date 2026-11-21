import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteDemoData, deleteShippingMethod, saveShippingMethod, saveSiteSettings } from "@/server/admin/settings";
import { formatMoney, toInputValue } from "@/lib/money";
import { pickLocale } from "@/lib/utils";
import { bpsToPercent } from "@/features/admin/lib/helpers";
import { Alert, Badge } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/features/admin/ui/primitives";
import { ActionForm, CheckboxField, FormSection, FormSubmit, LocalizedFields, MoneyField, TextField } from "@/features/admin/ui/action-form";
import { ActionButton } from "@/features/admin/ui/action-button";

export const metadata = { title: "Ayarlar" };
type L = { tr?: string; en?: string };
type Rec = Record<string, string | undefined>;

function ShippingFields({ m }: { m?: { code: string; name: L; description: L; price: number; free_over: number | null; is_active: boolean; position: number } }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[1fr_8rem]">
        <TextField name="code" label="Kod *" defaultValue={m?.code ?? ""} maxLength={40} required hint="örn. standart, hizli" />
        <TextField name="position" label="Sıra" type="number" min={0} defaultValue={String(m?.position ?? 0)} />
      </div>
      <LocalizedFields base="name" label="Ad" values={m?.name} requireTr maxLength={80} />
      <LocalizedFields base="description" label="Açıklama" values={m?.description} maxLength={300} hint="Teslim süresi gibi bilgileri yalnızca işletme doğruladıysa yazın." />
      <div className="grid gap-4 md:grid-cols-2">
        <MoneyField name="price" label="Ücret *" defaultValue={toInputValue(m?.price ?? 0)} />
        <MoneyField name="free_over" label="Ücretsiz kargo eşiği" defaultValue={toInputValue(m?.free_over)} hint="İndirim sonrası ara toplam bu tutara ulaşırsa ücretsiz. Boş = yok." />
      </div>
      <CheckboxField name="is_active" label="Aktif (ödeme adımında sunulur)" defaultChecked={m?.is_active ?? true} />
    </div>
  );
}

export default async function SettingsPage() {
  await requireStaff("settings.manage");
  const supabase = await createClient();
  const [{ data: s }, { data: methods }, { count: demoCount }] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("shipping_methods").select("*").order("position"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_demo", true),
  ]);
  const company = (s?.company_info ?? {}) as Rec;
  const social = (s?.social_links ?? {}) as Rec;
  const missingCompany = !company.legal_name || !company.address;

  return (
    <div className="max-w-5xl">
      <PageHeader title="Ayarlar" description="Mağaza bilgileri, vergi, rezervasyon süresi, kargo ücretleri ve yasal işletme bilgileri." />
      {missingCompany ? (
        <Alert tone="warning" className="mb-6" title="Yasal işletme bilgileri eksik">
          Mesafeli satış sözleşmesi ve ön bilgilendirme formu için şirket unvanı ve adresi gereklidir. Bu bilgiler olmadan canlı satışa geçmeyin.
        </Alert>
      ) : null}

      <ActionForm action={saveSiteSettings} className="grid gap-6" successMessage="Ayarlar kaydedildi.">
        <FormSection title="Mağaza">
          <div className="grid gap-4 md:grid-cols-3">
            <TextField name="store_name" label="Mağaza adı *" defaultValue={s?.store_name ?? "MAISON SURGE"} maxLength={80} />
            <TextField name="support_email" label="Destek e-postası" type="email" defaultValue={s?.support_email ?? ""} maxLength={254} />
            <TextField name="support_phone" label="Destek telefonu" type="tel" defaultValue={s?.support_phone ?? ""} maxLength={20} />
          </div>
        </FormSection>
        <FormSection title="Duyuru çubuğu">
          <LocalizedFields base="announcement" label="Duyuru metni" values={s?.announcement as L} maxLength={200} hint="Doğrulanmamış kampanya/kargo vaadi yazmayın." />
          <CheckboxField name="announcement_enabled" label="Duyuru çubuğunu göster" defaultChecked={s?.announcement_enabled ?? false} />
        </FormSection>
        <FormSection title="Vergi ve sipariş kuralları" description="Fiyatlar KDV dahildir. KDV oranı boşsa sepette KDV satırı gösterilmez.">
          <div className="grid gap-4 md:grid-cols-4">
            <TextField name="vat_percent" label="KDV oranı (%)" inputMode="decimal" defaultValue={bpsToPercent(s?.vat_rate_bps)} hint="Mali müşavirinizle doğrulayın." />
            <TextField name="reservation_minutes" label="Stok rezervasyon süresi (dk)" type="number" min={5} max={240} defaultValue={String(s?.reservation_minutes ?? 30)} hint="Ödeme beklenirken stok bu süre tutulur." />
            <TextField name="low_stock_threshold" label="Varsayılan az stok eşiği" type="number" min={0} defaultValue={String(s?.low_stock_threshold ?? 3)} />
            <TextField name="terms_version" label="Sözleşme sürümü *" defaultValue={s?.terms_version ?? ""} maxLength={40} hint="Metinler değişince güncelleyin; siparişe kaydedilir." />
          </div>
        </FormSection>
        <FormSection title="Yasal işletme bilgileri" description="Yalnızca işletmenin resmi bilgilerini girin. Bu alanlar yasal sayfalarda kullanılır.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField name="company_legal_name" label="Ticari unvan" defaultValue={company.legal_name ?? ""} maxLength={500} />
            <TextField name="company_address" label="Adres" defaultValue={company.address ?? ""} maxLength={500} />
            <TextField name="company_mersis_no" label="MERSİS no" defaultValue={company.mersis_no ?? ""} maxLength={500} />
            <TextField name="company_trade_registry_no" label="Ticaret sicil no" defaultValue={company.trade_registry_no ?? ""} maxLength={500} />
            <TextField name="company_tax_office" label="Vergi dairesi" defaultValue={company.tax_office ?? ""} maxLength={500} />
            <TextField name="company_tax_number" label="Vergi no" defaultValue={company.tax_number ?? ""} maxLength={500} />
            <TextField name="company_kep_address" label="KEP adresi" defaultValue={company.kep_address ?? ""} maxLength={500} />
          </div>
        </FormSection>
        <FormSection title="Sosyal medya">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField name="social_instagram" label="Instagram" type="url" placeholder="https://instagram.com/…" defaultValue={social.instagram ?? ""} />
            <TextField name="social_x" label="X" type="url" placeholder="https://x.com/…" defaultValue={social.x ?? ""} />
            <TextField name="social_tiktok" label="TikTok" type="url" placeholder="https://tiktok.com/@…" defaultValue={social.tiktok ?? ""} />
            <TextField name="social_youtube" label="YouTube" type="url" placeholder="https://youtube.com/@…" defaultValue={social.youtube ?? ""} />
          </div>
        </FormSection>
        <div className="flex justify-end">
          <FormSubmit>Ayarları kaydet</FormSubmit>
        </div>
      </ActionForm>

      <Card title="Teslimat yöntemleri ve kargo ücretleri" className="mt-10">
        <div className="grid gap-4">
          {(methods ?? []).map((m) => (
            <details key={m.id} className="rounded-sm border border-line">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{pickLocale(m.name, "tr")}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {formatMoney(m.price)}
                  {m.free_over ? ` · ${formatMoney(m.free_over)} üzeri ücretsiz` : ""}
                  {m.is_active ? <Badge tone="success">Aktif</Badge> : <Badge>Pasif</Badge>}
                </span>
              </summary>
              <div className="border-t border-line p-4">
                <ActionForm action={saveShippingMethod.bind(null, m.id)} className="grid gap-4">
                  <ShippingFields m={{ ...m, name: m.name as L, description: m.description as L }} />
                  <div className="flex justify-between gap-2">
                    <ActionButton action={deleteShippingMethod.bind(null, m.id)} variant="ghost" confirm={{ title: "Teslimat yöntemi silinsin mi?", body: "Geçici olarak kaldırmak için pasif yapmanız önerilir.", confirmLabel: "Sil" }}>
                      Sil
                    </ActionButton>
                    <FormSubmit size="sm">Kaydet</FormSubmit>
                  </div>
                </ActionForm>
              </div>
            </details>
          ))}
          {(methods ?? []).length === 0 ? <Alert tone="danger">Aktif teslimat yöntemi yok — ödeme adımı çalışmaz.</Alert> : null}
          <details className="rounded-sm border border-dashed border-line bg-sand-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">+ Yeni teslimat yöntemi</summary>
            <div className="border-t border-line p-4">
              <ActionForm action={saveShippingMethod.bind(null, null)} className="grid gap-4" resetOnSuccess successMessage="Teslimat yöntemi eklendi.">
                <ShippingFields />
                <div className="flex justify-end">
                  <FormSubmit size="sm">Ekle</FormSubmit>
                </div>
              </ActionForm>
            </div>
          </details>
        </div>
      </Card>

      <Card title="Tehlikeli bölge" className="mt-10 border-burgundy/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium">Demo verilerini sil</p>
            <p className="text-muted">
              Kurulumla gelen {demoCount ?? 0} demo ürünü (ve varyant/görsellerini) siler. Siparişe bağlı olanlar silinemezse arşivlenir. Kategoriler, sayfalar ve ayarlar korunur.
            </p>
          </div>
          <ActionButton
            action={deleteDemoData}
            variant="danger"
            disabled={(demoCount ?? 0) === 0}
            confirm={{ title: "Demo ürünler silinsin mi?", body: "Bu işlem geri alınamaz.", confirmLabel: "Demo verilerini sil" }}
          >
            Demo verilerini sil
          </ActionButton>
        </div>
      </Card>
    </div>
  );
}
