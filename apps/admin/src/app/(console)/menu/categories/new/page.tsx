import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";

import { CategoryForm } from "../../category-form";

export default async function NewCategoryPage() {
  if (!(await requireStaff()).isAdmin) redirect("/menu");
  const t = await getTranslations("admin");
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">{t("newCategory")}</h1>
      <CategoryForm
        id={null}
        initial={{
          nameEn: "",
          nameAr: "",
          descriptionEn: "",
          descriptionAr: "",
          sortOrder: "0",
          isActive: true,
        }}
      />
    </div>
  );
}
