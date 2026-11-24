import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";

import { BranchForm, emptyBranch } from "../branch-form";

export default async function NewBranchPage() {
  const staff = await requireStaff();
  if (!staff.isAdmin) redirect("/branches");
  const t = await getTranslations("admin");
  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-2xl font-bold">{t("newBranch")}</h1>
      <BranchForm id={null} initial={emptyBranch} />
    </div>
  );
}
