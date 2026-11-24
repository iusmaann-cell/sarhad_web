"use server";

import { categorySchema, fieldErrors, menuItemSchema } from "@sarhad/core";
import { revalidatePath } from "next/cache";

import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const staff = await requireStaff();
  return staff.isAdmin;
}

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: "notAllowed" };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  const row = {
    name_en: c.nameEn,
    name_ar: c.nameAr,
    description_en: c.descriptionEn,
    description_ar: c.descriptionAr,
    sort_order: c.sortOrder,
    is_active: c.isActive,
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("menu_categories").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("menu_categories").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: error ? dbErrorMessage(error) : "notAllowed" };
  revalidatePath("/menu");
  return { ok: true, message: "categorySaved", id: data.id };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: "notAllowed" };
  const supabase = await createClient();
  const { error } = await supabase.from("menu_categories").delete().eq("id", id);
  if (error)
    return {
      ok: false,
      message: error.code === "23503" ? "categoryNotEmpty" : dbErrorMessage(error),
    };
  revalidatePath("/menu");
  return { ok: true, message: "categoryDeleted" };
}

export async function saveItem(id: string | null, input: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: "notAllowed" };
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const i = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_menu_item", {
    p_item: {
      id,
      category_id: i.categoryId,
      name_en: i.nameEn,
      name_ar: i.nameAr,
      description_en: i.descriptionEn,
      description_ar: i.descriptionAr,
      price_fils: i.price,
      calories: i.calories,
      image_path: i.imagePath,
      sort_order: i.sortOrder,
      is_active: i.isActive,
      is_featured: i.isFeatured,
      modifier_groups: i.modifierGroups.map((g) => ({
        id: g.id ?? null,
        name_en: g.nameEn,
        name_ar: g.nameAr,
        min_select: g.minSelect,
        max_select: g.maxSelect,
        options: g.options.map((o) => ({
          id: o.id ?? null,
          name_en: o.nameEn,
          name_ar: o.nameAr,
          price_delta_fils: o.price,
        })),
      })),
    },
  });
  if (error || !data) return { ok: false, message: error ? dbErrorMessage(error) : "notAllowed" };
  revalidatePath("/menu");
  return { ok: true, message: "itemSaved", id: data };
}

export async function deleteItem(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: "notAllowed" };
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/menu");
  return { ok: true, message: "itemDeleted" };
}

/** Branch staff: sold out on/off. Managers: also the branch price (null = base price). */
export async function setAvailability(
  branchId: string,
  itemId: string,
  isAvailable: boolean,
  priceOverrideFils: number | null,
): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("branch_menu_items")
    .upsert(
      {
        branch_id: branchId,
        item_id: itemId,
        is_available: isAvailable,
        price_override_fils: priceOverrideFils,
      },
      { onConflict: "branch_id,item_id" },
    );
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501" && error.message.includes("price")
          ? "onlyManagersPrices"
          : dbErrorMessage(error),
    };
  }
  revalidatePath("/menu/availability");
  return { ok: true, message: "availabilitySaved" };
}
