import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { formatDate } from "@/lib/utils";
import { pageRange } from "@/features/admin/lib/helpers";
import { Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/feedback";
import { EmptyRow, FilterBar, FilterField, PageHeader, Pagination, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";

export const metadata = { title: "İletişim mesajları" };
const PAGE_SIZE = 25;
const MESSAGE_STATUS: Record<string, { label: string; tone: "warning" | "neutral" | "success" }> = {
  new: { label: "Yeni", tone: "warning" },
  read: { label: "Okundu", tone: "success" },
  archived: { label: "Arşiv", tone: "neutral" },
};

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("inbox.manage");
  const params = await searchParams;
  const status = sp(params, "status");
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const supabase = await createClient();
  const { from, to } = pageRange(page, PAGE_SIZE);
  let query = supabase.from("contact_messages").select("id, name, email, subject, status, created_at, order_number", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (status === "new" || status === "read" || status === "archived") query = query.eq("status", status);
  else query = query.neq("status", "archived");
  const { data, count } = await query;
  const total = count ?? 0;

  return (
    <div className="max-w-5xl">
      <PageHeader title="İletişim mesajları" description="İletişim formundan gelen mesajlar. Varsayılan görünüm arşivlenmemiş mesajlardır." />
      <FilterBar action="/admin/inbox">
        <FilterField label="Durum">
          <Select name="status" defaultValue={status}>
            <option value="">Açık (yeni + okundu)</option>
            <option value="new">Yeni</option>
            <option value="read">Okundu</option>
            <option value="archived">Arşiv</option>
          </Select>
        </FilterField>
      </FilterBar>
      <TableWrap label="Mesajlar">
        <thead>
          <tr>
            <Th>Konu</Th>
            <Th>Gönderen</Th>
            <Th>Tarih</Th>
            <Th>Durum</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).length === 0 ? <EmptyRow colSpan={4}>Mesaj yok.</EmptyRow> : null}
          {(data ?? []).map((m) => (
            <tr key={m.id} className={m.status === "new" ? "font-medium" : undefined}>
              <Td>
                <Link href={`/admin/inbox/${m.id}`} className="underline-offset-4 hover:underline">
                  {m.subject}
                </Link>
                {m.order_number ? <span className="block text-xs text-muted">Sipariş: {m.order_number}</span> : null}
              </Td>
              <Td className="text-xs">
                {m.name}
                <span className="block text-muted">{m.email}</span>
              </Td>
              <Td className="text-xs">{formatDate(m.created_at, "tr", true)}</Td>
              <Td>
                <Badge tone={MESSAGE_STATUS[m.status]?.tone}>{MESSAGE_STATUS[m.status]?.label ?? m.status}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} basePath="/admin/inbox" params={{ status }} />
    </div>
  );
}
