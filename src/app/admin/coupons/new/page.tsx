import { requireStaff } from "@/server/auth";
import { saveCoupon } from "@/server/admin/coupons";
import { PageHeader } from "@/features/admin/ui/primitives";
import { CouponForm } from "@/features/admin/coupons/coupon-form";

export const metadata = { title: "Yeni kupon" };

export default async function NewCouponPage() {
  await requireStaff("coupons.manage");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Yeni kupon" back={{ href: "/admin/coupons", label: "Kuponlar" }} />
      <CouponForm action={saveCoupon.bind(null, null)} values={null} />
    </div>
  );
}
