import type { Locale } from "@sarhad/i18n";
import { Button } from "@sarhad/ui";
import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { OrdersBoard } from "@/components/orders/orders-board";
import { loadBoard, staffBranches } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";

import { BranchTabs } from "./branch-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ops");
  return { title: t("title") };
}

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const staff = await requireStaff();
  const [t, ta, locale] = await Promise.all([
    getTranslations("ops"),
    getTranslations("admin"),
    getLocale() as Promise<Locale>,
  ]);
  const branches = await staffBranches(staff);
  const sp = await searchParams;
  const branch = branches.find((b) => b.id === sp.branch) ?? branches[0];

  if (!branch) return <p className="text-muted-foreground">{t("noBranches")}</p>;

  const initial = await loadBoard(branch.id);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild variant="outline">
          <Link href={`/orders/history?branch=${branch.id}`}>
            <History /> {t("history")}
          </Link>
        </Button>
      </div>
      <BranchTabs
        branches={branches}
        current={branch.id}
        locale={locale}
        label={ta("branchFilter")}
        basePath="/orders"
      />
      {/* key: a fresh board (and alert memory) per branch */}
      <OrdersBoard
        key={branch.id}
        branchId={branch.id}
        baseTitle={`${t("title")} | ${ta("title")}`}
        initial={initial}
      />
    </div>
  );
}
