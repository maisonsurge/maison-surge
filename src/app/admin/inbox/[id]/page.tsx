import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteMessage, setMessageStatus } from "@/server/admin/inbox";
import { isUuid } from "@/server/admin/common";
import { formatDate } from "@/lib/utils";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/feedback";
import { Card, KeyValue, PageHeader } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";

export const metadata = { title: "Mesaj" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { roles } = await requireStaff("inbox.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: m } = await supabase.from("contact_messages").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();
  const { data: order } =
    m.order_number && rolesHavePermission(roles, "orders.view") ? await supabase.from("orders").select("id").eq("order_number", m.order_number).maybeSingle() : { data: null };
  const replyHref = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={m.subject}
        description={<Badge tone={m.status === "new" ? "warning" : "neutral"}>{m.status === "new" ? "Yeni" : m.status === "read" ? "Okundu" : "Arşiv"}</Badge>}
        back={{ href: "/admin/inbox", label: "Mesajlar" }}
        actions={
          <>
            <a href={replyHref} className="inline-flex h-9 items-center rounded-sm bg-ink px-3 text-xs uppercase tracking-wide text-paper hover:bg-forest">
              E-posta ile yanıtla
            </a>
            {m.status !== "read" ? (
              <ActionButton action={setMessageStatus.bind(null, m.id, "read")} variant="outline">
                Okundu
              </ActionButton>
            ) : (
              <ActionButton action={setMessageStatus.bind(null, m.id, "new")} variant="outline">
                Yeni olarak işaretle
              </ActionButton>
            )}
            {m.status !== "archived" ? (
              <ActionButton action={setMessageStatus.bind(null, m.id, "archived")} variant="outline">
                Arşivle
              </ActionButton>
            ) : null}
            <ActionButton action={deleteMessage.bind(null, m.id)} variant="danger" confirm={{ title: "Mesaj kalıcı olarak silinsin mi?", body: "Kişisel veri içerdiği için saklama süresi dolduğunda silinmesi önerilir.", confirmLabel: "Sil" }}>
              Sil
            </ActionButton>
          </>
        }
      />
      <Card>
        <KeyValue
          items={[
            ["Gönderen", m.name],
            ["E-posta", m.email],
            ["Tarih", formatDate(m.created_at, "tr", true)],
            [
              "Sipariş",
              m.order_number ? (
                order ? (
                  <Link key="o" href={`/admin/orders/${order.id}`} className="underline underline-offset-4">
                    {m.order_number}
                  </Link>
                ) : (
                  m.order_number
                )
              ) : (
                "—"
              ),
            ],
            ["Üye", m.user_id ? "Evet" : "Hayır"],
          ]}
        />
        <div className="mt-6 whitespace-pre-wrap border-t border-line pt-6 text-sm leading-relaxed">{m.message}</div>
      </Card>
    </div>
  );
}
