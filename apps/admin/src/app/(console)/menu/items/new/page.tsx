import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";

import { ItemForm } from "../../item-form";
import { loadCategories } from "../load";

export default async function NewItemPage({ searchParams }: PageProps<"/menu/items/new">) {
  if (!(await requireStaff()).isAdmin) redirect("/menu");
  const t = await getTranslations("admin");
  const categories = await loadCategories();
  if (!categories.length) redirect("/menu/categories/new");
  const sp = await searchParams;
  const categoryId = typeof sp.category === "string" ? sp.category : categories[0]!.id;
  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-2xl font-bold">{t("newItem")}</h1>
      <ItemForm
        id={null}
        categories={categories}
        initial={{
          categoryId,
          nameEn: "",
          nameAr: "",
          descriptionEn: "",
          descriptionAr: "",
          price: "",
          calories: "",
          imagePath: "",
          sortOrder: "0",
          isActive: true,
          isFeatured: false,
          modifierGroups: [],
        }}
      />
    </div>
  );
}
