import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteSubscriber } from "@/server/admin/inbox";
import { sanitizeSearch } from "@/server/admin/common";
import { formatDate } from "@/lib/utils";
import { pageRange } from "@/features/admin/lib/helpers";
import { Input, Select } from "@/components/ui/form";
import { Alert, Badge } from "@/components/ui/feedback";
import { EmptyRow, FilterBar, FilterField, PageHeader, Pagination, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";

export const metadata = { title: "Bülten" };
const PAGE_SIZE = 50;
const STATUS: Record<string, { label: string; tone: "warning" | "success" | "neutral" }> = {
  pending: { label: "Onay bekliyor", tone: "warning" },
  confirmed: { label: "Onaylı", tone: "success" },
  unsubscribed: { label: "Ayrıldı", tone: "neutral" },
};

export default async function NewsletterPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("newsletter.view");
  const params = await searchParams;
  const status = sp(params, "status");
  const q = sanitizeSearch(sp(params, "q"));
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const supabase = await createClient();
  const { from, to } = pageRange(page, PAGE_SIZE);
  let query = supabase
    .from("newsletter_subscriptions")
    .select("id, email, status, locale, source, consent_text_version, consent_at, confirmed_at, unsubscribed_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status === "pending" || status === "confirmed" || status === "unsubscribed") query = query.eq("status", status);
  if (q) query = query.ilike("email", `%${q}%`);
  const { data, count } = await query;
  const total = count ?? 0;
  const exportHref = `/admin/newsletter/export${status ? `?status=${status}` : ""}`;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Bülten aboneleri"
        description="Yalnızca açık rıza veren kişiler listelenir. Ticari ileti gönderiminde yalnızca “Onaylı” aboneleri kullanın (İYS kaydı işletme sorumluluğundadır)."
        actions={
          <a href={exportHref} className="inline-flex h-11 items-center rounded-sm border border-ink px-4 text-xs uppercase tracking-wide hover:bg-ink hover:text-paper">
            CSV indir
          </a>
        }
      />
      <Alert tone="neutral" className="mb-4">
        E-posta sağlayıcısı (RESEND_API_KEY) yapılandırılmadıysa çift onay e-postası gönderilemez; kayıtlar “Onay bekliyor” durumunda kalır.
      </Alert>
      <FilterBar action="/admin/newsletter">
        <FilterField label="E-posta" className="flex-1">
          <Input name="q" defaultValue={q} />
        </FilterField>
        <FilterField label="Durum">
          <Select name="status" defaultValue={status}>
            <option value="">Tümü</option>
            <option value="confirmed">Onaylı</option>
            <option value="pending">Onay bekliyor</option>
            <option value="unsubscribed">Ayrıldı</option>
          </Select>
        </FilterField>
      </FilterBar>
      <TableWrap label="Aboneler">
        <thead>
          <tr>
            <Th>E-posta</Th>
            <Th>Durum</Th>
            <Th>Rıza</Th>
            <Th>Kaynak / dil</Th>
            <Th>
              <span className="sr-only">İşlem</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).length === 0 ? <EmptyRow colSpan={5}>Abone yok.</EmptyRow> : null}
          {(data ?? []).map((s) => (
            <tr key={s.id}>
              <Td>{s.email}</Td>
              <Td>
                <Badge tone={STATUS[s.status]?.tone}>{STATUS[s.status]?.label ?? s.status}</Badge>
              </Td>
              <Td className="text-xs">
                {formatDate(s.consent_at, "tr", true)}
                <span className="block text-muted">metin v{s.consent_text_version}</span>
              </Td>
              <Td className="text-xs">
                {s.source} · {s.locale.toUpperCase()}
              </Td>
              <Td className="text-right">
                <ActionButton action={deleteSubscriber.bind(null, s.id)} variant="ghost" confirm={{ title: "Abone kaydı silinsin mi?", body: "Silme talebi (KVKK) için kullanın. Rıza geçmişi de silinir.", confirmLabel: "Sil" }}>
                  Sil
                </ActionButton>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} basePath="/admin/newsletter" params={{ q, status }} />
    </div>
  );
}
