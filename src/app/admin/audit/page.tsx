import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { formatDate } from "@/lib/utils";
import { pageRange, shortId } from "@/features/admin/lib/helpers";
import { isUuid } from "@/server/admin/common";
import { Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/feedback";
import { EmptyRow, FilterBar, FilterField, PageHeader, Pagination, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";

export const metadata = { title: "Denetim kaydı" };
const PAGE_SIZE = 50;

const ENTITIES = [
  "products",
  "product_translations",
  "product_variants",
  "product_images",
  "product_costs",
  "categories",
  "collections",
  "collection_products",
  "sizes",
  "colors",
  "coupons",
  "shipping_methods",
  "homepage_sections",
  "content_pages",
  "site_settings",
  "orders",
  "shipments",
  "refunds",
  "user_roles",
  "contact_messages",
  "newsletter_subscriptions",
];

const ACTION_LABEL: Record<string, string> = { insert: "Oluşturma", update: "Güncelleme", delete: "Silme" };

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireStaff("audit.view");
  const params = await searchParams;
  const entity = sp(params, "entity");
  const actor = sp(params, "actor");
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const supabase = await createClient();
  const { from, to } = pageRange(page, PAGE_SIZE);
  let query = supabase.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (ENTITIES.includes(entity)) query = query.eq("entity", entity);
  if (isUuid(actor)) query = query.eq("actor_id", actor);
  const { data, count } = await query;
  const total = count ?? 0;
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const { data: emails } = actorIds.length ? await supabase.rpc("admin_user_emails", { p_ids: actorIds }) : { data: [] };
  const emailOf = new Map((emails ?? []).map((e) => [e.id, e.email]));

  return (
    <div>
      <PageHeader title="Denetim kaydı" description="Yönetim işlemleri veritabanı tetikleyicileriyle otomatik kaydedilir ve değiştirilemez. Kişisel veri içeren tablolarda yalnızca değişen alan adları tutulur." />
      <FilterBar action="/admin/audit">
        <FilterField label="Kayıt türü">
          <Select name="entity" defaultValue={entity}>
            <option value="">Tümü</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Kullanıcı ID" className="flex-1">
          <Input name="actor" defaultValue={actor} placeholder="uuid" />
        </FilterField>
      </FilterBar>
      <TableWrap label="Denetim kaydı">
        <thead>
          <tr>
            <Th>Tarih</Th>
            <Th>Kim</Th>
            <Th>İşlem</Th>
            <Th>Kayıt</Th>
            <Th>Değişiklik</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).length === 0 ? <EmptyRow colSpan={5}>Kayıt yok.</EmptyRow> : null}
          {(data ?? []).map((r) => (
            <tr key={r.id} className="align-top">
              <Td className="whitespace-nowrap text-xs">{formatDate(r.created_at, "tr", true)}</Td>
              <Td className="text-xs">
                {r.actor_id ? (
                  <a href={`/admin/audit?actor=${r.actor_id}`} className="underline-offset-4 hover:underline">
                    {r.actor_id === user.id ? "Siz" : (emailOf.get(r.actor_id) ?? shortId(r.actor_id))}
                  </a>
                ) : (
                  <span className="text-muted">Sistem</span>
                )}
              </Td>
              <Td>
                <Badge tone={r.action === "delete" ? "danger" : r.action === "insert" ? "success" : "neutral"}>{ACTION_LABEL[r.action] ?? r.action}</Badge>
              </Td>
              <Td className="text-xs">
                {r.entity}
                <span className="block font-mono text-muted">{shortId(r.entity_id)}</span>
              </Td>
              <Td className="max-w-md">
                <details>
                  <summary className="cursor-pointer text-xs text-muted">{Object.keys((r.changes as object) ?? {}).slice(0, 4).join(", ") || "—"}</summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all bg-sand-50 p-2 text-[0.68rem]">{JSON.stringify(r.changes, null, 2)}</pre>
                </details>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} basePath="/admin/audit" params={{ entity, actor }} />
    </div>
  );
}
