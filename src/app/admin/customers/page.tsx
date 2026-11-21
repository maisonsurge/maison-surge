import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { sanitizeSearch } from "@/server/admin/common";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/feedback";
import { EmptyRow, FilterBar, FilterField, PageHeader, Pagination, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";

export const metadata = { title: "Müşteriler" };
const PAGE_SIZE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("customers.view");
  const params = await searchParams;
  const q = sanitizeSearch(sp(params, "q"));
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_customers", { p_search: q || undefined, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);

  return (
    <div>
      <PageHeader title="Müşteriler" description="Yalnızca gerekli asgari bilgiler gösterilir (KVKK). Adresler müşteri hesabında saklanır." />
      <FilterBar action="/admin/customers">
        <FilterField label="E-posta veya ad" className="flex-1">
          <Input name="q" defaultValue={q} />
        </FilterField>
      </FilterBar>
      {error ? <p className="mb-3 text-sm text-danger">Müşteriler yüklenemedi.</p> : null}
      <TableWrap label="Müşteri listesi">
        <thead>
          <tr>
            <Th>Müşteri</Th>
            <Th>Kayıt</Th>
            <Th className="text-right">Ödenmiş sipariş</Th>
            <Th className="text-right">Net harcama</Th>
            <Th>Rol</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={5}>Müşteri bulunamadı.</EmptyRow> : null}
          {rows.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/admin/customers/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                  {c.full_name || c.email}
                </Link>
                {c.full_name ? <span className="block text-xs text-muted">{c.email}</span> : null}
              </Td>
              <Td className="text-xs">{formatDate(c.created_at, "tr")}</Td>
              <Td className="text-right tabular-nums">{c.order_count}</Td>
              <Td className="text-right tabular-nums">{formatMoney(Number(c.total_spent))}</Td>
              <Td>
                {(c.roles ?? []).map((r) => (
                  <Badge key={r} tone="info" className="mr-1">
                    {r}
                  </Badge>
                ))}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} basePath="/admin/customers" params={{ q }} />
    </div>
  );
}
