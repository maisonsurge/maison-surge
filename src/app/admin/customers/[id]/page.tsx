import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { isUuid } from "@/server/admin/common";
import { setUserRole } from "@/server/admin/customers";
import { rolesHavePermission, type AppRole } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Alert, Badge } from "@/components/ui/feedback";
import { Card, EmptyRow, KeyValue, OrderStatusBadge, PageHeader, PaymentStatusBadge, TableWrap, Td, Th } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";

export const metadata = { title: "Müşteri" };

const ROLE_INFO: Record<AppRole, string> = {
  staff: "Ürün, stok, sipariş işleme ve iletişim kutusu. İade, kupon, içerik, ayarlar ve müşteri listesine erişemez.",
  admin: "Tüm modüller, iadeler, rol yönetimi ve denetim kaydı.",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user: me, roles: myRoles } = await requireStaff("customers.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: profile }, { data: emails }, { data: roleRows }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, preferred_locale, marketing_consent, marketing_consent_at, created_at").eq("id", id).maybeSingle(),
    supabase.rpc("admin_user_emails", { p_ids: [id] }),
    supabase.from("user_roles").select("role, created_at").eq("user_id", id),
    rolesHavePermission(myRoles, "orders.view")
      ? supabase.from("orders").select("id, order_number, status, payment_status, grand_total, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const email = emails?.[0]?.email;
  if (!profile && !email) notFound();
  const roles = new Set((roleRows ?? []).map((r) => r.role));
  const canManageRoles = rolesHavePermission(myRoles, "roles.manage");
  const paid = (orders ?? []).filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.payment_status));

  return (
    <div className="max-w-5xl">
      <PageHeader title={profile?.full_name || email || "Müşteri"} description={email} back={{ href: "/admin/customers", label: "Müşteriler" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold">Siparişler ({(orders ?? []).length})</h2>
          <TableWrap label="Müşteri siparişleri">
            <thead>
              <tr>
                <Th>Sipariş</Th>
                <Th>Tarih</Th>
                <Th>Durum</Th>
                <Th>Ödeme</Th>
                <Th className="text-right">Tutar</Th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).length === 0 ? <EmptyRow colSpan={5}>Sipariş yok.</EmptyRow> : null}
              {(orders ?? []).map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                      {o.order_number}
                    </Link>
                  </Td>
                  <Td className="text-xs">{formatDate(o.created_at, "tr", true)}</Td>
                  <Td>
                    <OrderStatusBadge status={o.status} />
                  </Td>
                  <Td>
                    <PaymentStatusBadge status={o.payment_status} />
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(o.grand_total)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
        <aside className="grid content-start gap-6">
          <Card title="Profil">
            <KeyValue
              items={[
                ["Ad", profile?.full_name ?? "—"],
                ["E-posta", email ?? "—"],
                ["Telefon", profile?.phone ?? "—"],
                ["Dil", (profile?.preferred_locale ?? "tr").toUpperCase()],
                ["Pazarlama izni", profile?.marketing_consent ? `Evet${profile.marketing_consent_at ? ` (${formatDate(profile.marketing_consent_at, "tr")})` : ""}` : "Hayır"],
                ["Kayıt", profile ? formatDate(profile.created_at, "tr") : "—"],
                ["Ödenmiş sipariş", String(paid.length)],
              ]}
            />
          </Card>
          <Card title="Yetkiler">
            <div className="mb-3 flex flex-wrap gap-1">
              {roles.size === 0 ? <span className="text-sm text-muted">Müşteri (yetki yok)</span> : null}
              {[...roles].map((r) => (
                <Badge key={r} tone="info">
                  {r}
                </Badge>
              ))}
            </div>
            {canManageRoles ? (
              <div className="grid gap-3">
                {(["staff", "admin"] as AppRole[]).map((r) => {
                  const has = roles.has(r);
                  const self = id === me.id && r === "admin" && has;
                  return (
                    <div key={r} className="rounded-sm border border-line p-3">
                      <p className="text-sm font-medium">{r}</p>
                      <p className="mb-2 text-xs text-muted">{ROLE_INFO[r]}</p>
                      <ActionButton
                        action={setUserRole.bind(null, id, r, !has)}
                        variant={has ? "outline" : "secondary"}
                        disabled={self}
                        confirm={{
                          title: has ? `${r} rolü kaldırılsın mı?` : `${r} rolü verilsin mi?`,
                          body: has ? "Kullanıcı bu rolün yetkilerini hemen kaybeder." : `${email ?? "Bu kullanıcı"} yönetim paneline erişebilecek. Yalnızca güvendiğiniz ekip üyelerine verin.`,
                          confirmLabel: has ? "Rolü kaldır" : "Rolü ver",
                        }}
                      >
                        {has ? "Rolü kaldır" : "Rol ver"}
                      </ActionButton>
                      {self ? <p className="mt-1 text-xs text-muted">Kendi admin yetkinizi kaldıramazsınız.</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Alert tone="neutral">Rol yönetimi yalnızca admin yetkisiyle yapılır.</Alert>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
