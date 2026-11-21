import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { sanitizeSearch } from "@/server/admin/common";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@/lib/orders/transitions";
import { istanbulLocalToIso, pageRange } from "@/features/admin/lib/helpers";
import { Input, Select } from "@/components/ui/form";
import {
  EmptyRow,
  FilterBar,
  FilterField,
  ORDER_STATUS_LABELS,
  OrderStatusBadge,
  PAYMENT_STATUS_LABELS,
  PageHeader,
  Pagination,
  PaymentStatusBadge,
  TableWrap,
  Td,
  Th,
  sp,
  type SearchParams,
} from "@/features/admin/ui/primitives";

export const metadata = { title: "Siparişler" };
const PAGE_SIZE = 25;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("orders.view");
  const params = await searchParams;
  const status = sp(params, "status");
  const paymentStatus = sp(params, "payment_status");
  const q = sanitizeSearch(sp(params, "q"));
  const fromDate = sp(params, "from");
  const toDate = sp(params, "to");
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const supabase = await createClient();

  const { from, to } = pageRange(page, PAGE_SIZE);
  let query = supabase
    .from("orders")
    .select("id, order_number, email, status, payment_status, grand_total, created_at, user_id, order_items ( quantity )", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status && status in ORDER_STATUS_LABELS) query = query.eq("status", status as OrderStatus);
  if (paymentStatus && paymentStatus in PAYMENT_STATUS_LABELS) query = query.eq("payment_status", paymentStatus as PaymentStatus);
  if (q) query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%`);
  const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? istanbulLocalToIso(`${fromDate}T00:00`) : null;
  const toIso = /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? istanbulLocalToIso(`${toDate}T23:59:59`) : null;
  if (fromIso && fromIso !== "invalid") query = query.gte("created_at", fromIso);
  if (toIso && toIso !== "invalid") query = query.lte("created_at", toIso);
  const { data, count, error } = await query;
  const total = count ?? 0;

  return (
    <div>
      <PageHeader title="Siparişler" description="Ödeme durumu yalnızca doğrulanmış ödeme olaylarıyla değişir; elle değiştirilemez." />
      <FilterBar action="/admin/orders">
        <FilterField label="Sipariş no / e-posta" className="flex-1">
          <Input name="q" defaultValue={q} />
        </FilterField>
        <FilterField label="Sipariş durumu">
          <Select name="status" defaultValue={status}>
            <option value="">Tümü</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Ödeme durumu">
          <Select name="payment_status" defaultValue={paymentStatus}>
            <option value="">Tümü</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Başlangıç">
          <Input type="date" name="from" defaultValue={fromDate} />
        </FilterField>
        <FilterField label="Bitiş">
          <Input type="date" name="to" defaultValue={toDate} />
        </FilterField>
      </FilterBar>

      {error ? <p className="mb-3 text-sm text-danger">Siparişler yüklenemedi.</p> : null}
      <TableWrap label="Sipariş listesi">
        <thead>
          <tr>
            <Th>Sipariş</Th>
            <Th>Tarih</Th>
            <Th>Müşteri</Th>
            <Th>Durum</Th>
            <Th>Ödeme</Th>
            <Th className="text-right">Adet</Th>
            <Th className="text-right">Tutar</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).length === 0 ? <EmptyRow colSpan={7}>Sipariş bulunamadı.</EmptyRow> : null}
          {(data ?? []).map((o) => (
            <tr key={o.id}>
              <Td>
                <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                  {o.order_number}
                </Link>
              </Td>
              <Td className="whitespace-nowrap text-xs">{formatDate(o.created_at, "tr", true)}</Td>
              <Td className="text-xs">
                {o.email}
                <span className="block text-muted">{o.user_id ? "Üye" : "Misafir"}</span>
              </Td>
              <Td>
                <OrderStatusBadge status={o.status} />
              </Td>
              <Td>
                <PaymentStatusBadge status={o.payment_status} />
              </Td>
              <Td className="text-right tabular-nums">{o.order_items.reduce((n, i) => n + i.quantity, 0)}</Td>
              <Td className="text-right tabular-nums">{formatMoney(o.grand_total)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
        basePath="/admin/orders"
        params={{ q, status, payment_status: paymentStatus, from: fromDate, to: toDate }}
      />
    </div>
  );
}
