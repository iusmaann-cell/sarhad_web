import { canManageBranch, type OpeningHours } from "@sarhad/core";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { BranchForm } from "../branch-form";

export default async function EditBranchPage({ params }: PageProps<"/branches/[id]">) {
  const { id } = await params;
  const staff = await requireStaff();
  if (!canManageBranch(staff.roles, id)) redirect("/branches");

  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data: b } = await supabase.from("branches").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();

  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-2xl font-bold">{t("editBranch")}</h1>
      <BranchForm
        id={b.id}
        initial={{
          nameEn: b.name_en,
          nameAr: b.name_ar,
          slug: b.slug,
          addressEn: b.address_en ?? "",
          addressAr: b.address_ar ?? "",
          phone: b.phone ?? "",
          whatsapp: b.whatsapp ?? "",
          latitude: b.latitude?.toString() ?? "",
          longitude: b.longitude?.toString() ?? "",
          isActive: b.is_active,
          acceptsDelivery: b.accepts_delivery,
          acceptsPickup: b.accepts_pickup,
          sortOrder: String(b.sort_order),
          openingHours: (b.opening_hours ?? {}) as OpeningHours,
        }}
      />
    </div>
  );
}
