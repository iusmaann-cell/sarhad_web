import { filsToKwd, kuwaitDay, promoLastDay } from "@sarhad/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { promoBranches } from "../load";
import { PromoForm } from "../promo-form";

export default async function EditPromoPage({ params }: PageProps<"/promotions/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, branches, t] = await Promise.all([
    supabase.from("promo_codes").select("*").eq("id", id).maybeSingle(),
    promoBranches(staff),
    getTranslations("promos"),
  ]);
  if (!p) notFound();
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">
        {t("edit")} · <span dir="ltr">{p.code}</span>
      </h1>
      <PromoForm
        id={p.id}
        branches={branches}
        allowAllBranches={staff.isAdmin}
        initial={{
          code: p.code,
          nameEn: p.name_en,
          nameAr: p.name_ar,
          kind: p.kind,
          value:
            p.kind === "percent" ? String(p.value) : p.kind === "fixed" ? filsToKwd(p.value) : "",
          minSubtotal: p.min_subtotal_fils ? filsToKwd(p.min_subtotal_fils) : "",
          maxDiscount: p.max_discount_fils ? filsToKwd(p.max_discount_fils) : "",
          branchId: p.branch_id ?? "",
          startsOn: p.starts_at ? kuwaitDay(p.starts_at) : "",
          endsOn: p.ends_at ? promoLastDay(p.ends_at) : "",
          maxUses: p.max_uses ? String(p.max_uses) : "",
          maxUsesPerCustomer: p.max_uses_per_customer ? String(p.max_uses_per_customer) : "",
          firstOrderOnly: p.first_order_only,
          isActive: p.is_active,
        }}
      />
    </div>
  );
}
