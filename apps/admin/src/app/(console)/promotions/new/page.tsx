import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";

import { EMPTY_PROMO, promoBranches } from "../load";
import { PromoForm } from "../promo-form";

export default async function NewPromoPage() {
  const staff = await requireStaff();
  const branches = await promoBranches(staff);
  if (!staff.isAdmin && branches.length === 0) redirect("/promotions");
  const t = await getTranslations("promos");
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">{t("new")}</h1>
      <PromoForm
        id={null}
        initial={{ ...EMPTY_PROMO, branchId: staff.isAdmin ? "" : (branches[0]?.id ?? "") }}
        branches={branches}
        allowAllBranches={staff.isAdmin}
      />
    </div>
  );
}
