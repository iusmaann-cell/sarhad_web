import { filsToKwd } from "@sarhad/core";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { ItemForm } from "../../item-form";
import { loadCategories } from "../load";

export default async function EditItemPage({ params }: PageProps<"/menu/items/[id]">) {
  if (!(await requireStaff()).isAdmin) redirect("/menu");
  const { id } = await params;
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [{ data: item }, categories] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*, modifier_groups(*, modifier_options(*))")
      .eq("id", id)
      .maybeSingle(),
    loadCategories(),
  ]);
  if (!item) notFound();

  const groups = [...(item.modifier_groups ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-2xl font-bold">{t("editItem")}</h1>
      <ItemForm
        id={item.id}
        categories={categories}
        initial={{
          categoryId: item.category_id,
          nameEn: item.name_en,
          nameAr: item.name_ar,
          descriptionEn: item.description_en ?? "",
          descriptionAr: item.description_ar ?? "",
          price: filsToKwd(item.price_fils),
          calories: item.calories?.toString() ?? "",
          imagePath: item.image_path ?? "",
          sortOrder: String(item.sort_order),
          isActive: item.is_active,
          isFeatured: item.is_featured,
          modifierGroups: groups.map((g) => ({
            id: g.id,
            nameEn: g.name_en,
            nameAr: g.name_ar,
            minSelect: String(g.min_select),
            maxSelect: String(g.max_select),
            options: [...(g.modifier_options ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((o) => ({
                id: o.id,
                nameEn: o.name_en,
                nameAr: o.name_ar,
                price: filsToKwd(o.price_delta_fils),
              })),
          })),
        }}
      />
    </div>
  );
}
