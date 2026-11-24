import { z } from "zod";

// ---------------------------------------------------------------------------
// Shape returned by public.get_branch_menu(branch_id)
// ---------------------------------------------------------------------------

export type MenuOption = {
  id: string;
  name_en: string;
  name_ar: string;
  price_delta_fils: number;
};

export type MenuModifierGroup = {
  id: string;
  name_en: string;
  name_ar: string;
  min_select: number;
  max_select: number;
  options: MenuOption[];
};

export type MenuItem = {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  image_path: string | null;
  calories: number | null;
  is_featured: boolean;
  price_fils: number;
  is_available: boolean;
  modifier_groups: MenuModifierGroup[];
};

export type MenuCategory = {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  items: MenuItem[];
};

export type BranchMenu = MenuCategory[];

export const MENU_IMAGES_BUCKET = "menu-images";

/** Public URL of a menu photo (bucket path or an absolute URL). */
export function menuImageUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MENU_IMAGES_BUCKET}/${path}`;
}

// ---------------------------------------------------------------------------
// Money: stored as integer fils, typed by staff as KWD with up to 3 decimals.
// ---------------------------------------------------------------------------

/** "2.250" -> 2250, "2" -> 2000, "0.5" -> 500. Returns null if not a valid amount. */
export function parseKwd(input: string): number | null {
  const v = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace("٫", ".");
  if (!/^\d{1,5}(\.\d{0,3})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  return Number(whole) * 1000 + Number(frac.padEnd(3, "0"));
}

/** 2250 -> "2.250" (for form inputs). */
export function filsToKwd(fils: number): string {
  return (fils / 1000).toFixed(3);
}

export const kwdField = (message: string) =>
  z.string().transform((v, ctx) => {
    const fils = parseKwd(v);
    if (fils === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return fils;
  });

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

export const categorySchema = z.object({
  nameEn: z.string().trim().min(1, "required").max(80),
  nameAr: z.string().trim().min(1, "required").max(80),
  descriptionEn: optionalText,
  descriptionAr: optionalText,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const modifierOptionSchema = z.object({
  id: z.string().uuid().optional(),
  nameEn: z.string().trim().min(1, "required").max(80),
  nameAr: z.string().trim().min(1, "required").max(80),
  price: kwdField("invalidPrice"),
});

export const modifierGroupSchema = z
  .object({
    id: z.string().uuid().optional(),
    nameEn: z.string().trim().min(1, "required").max(80),
    nameAr: z.string().trim().min(1, "required").max(80),
    minSelect: z.coerce.number().int().min(0).max(20),
    maxSelect: z.coerce.number().int().min(1).max(20),
    options: z.array(modifierOptionSchema).min(1, "optionsRequired"),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { message: "minMoreThanMax", path: ["minSelect"] })
  .refine((g) => g.maxSelect <= g.options.length, {
    message: "maxMoreThanOptions",
    path: ["maxSelect"],
  });

export const menuItemSchema = z.object({
  categoryId: z.string().uuid("required"),
  nameEn: z.string().trim().min(1, "required").max(80),
  nameAr: z.string().trim().min(1, "required").max(80),
  descriptionEn: optionalText,
  descriptionAr: optionalText,
  price: kwdField("invalidPrice"),
  calories: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 10000) {
        ctx.addIssue({ code: "custom", message: "invalidNumber" });
        return z.NEVER;
      }
      return n;
    }),
  imagePath: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type MenuItemInput = z.input<typeof menuItemSchema>;
export type MenuItemData = z.output<typeof menuItemSchema>;

// ---------------------------------------------------------------------------
// Price of an item with chosen options, and checking the choice is valid.
// ---------------------------------------------------------------------------

export function itemTotalFils(item: MenuItem, selectedOptionIds: readonly string[]): number {
  const extras = item.modifier_groups
    .flatMap((g) => g.options)
    .filter((o) => selectedOptionIds.includes(o.id))
    .reduce((sum, o) => sum + o.price_delta_fils, 0);
  return item.price_fils + extras;
}

/** Group ids whose selection breaks the min/max rules. */
export function invalidModifierGroups(
  item: MenuItem,
  selectedOptionIds: readonly string[],
): string[] {
  return item.modifier_groups
    .filter((g) => {
      const n = g.options.filter((o) => selectedOptionIds.includes(o.id)).length;
      return n < g.min_select || n > g.max_select;
    })
    .map((g) => g.id);
}
