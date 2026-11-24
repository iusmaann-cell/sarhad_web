import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { CategoryForm } from "../../category-form";

export default async function EditCategoryPage({ params }: PageProps<"/menu/categories/[id]">) {
  if (!(await requireStaff()).isAdmin) redirect("/menu");
  const { id } = await params;
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data: c } = await supabase.from("menu_categories").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">{t("editCategory")}</h1>
      <CategoryForm
        id={c.id}
        initial={{
          nameEn: c.name_en,
          nameAr: c.name_ar,
          descriptionEn: c.description_en ?? "",
          descriptionAr: c.description_ar ?? "",
          sortOrder: String(c.sort_order),
          isActive: c.is_active,
        }}
      />
    </div>
  );
}
