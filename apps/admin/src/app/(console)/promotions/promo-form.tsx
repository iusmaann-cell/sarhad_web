"use client";

import { PROMO_KINDS, type PromoInput } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Button, Card, CardContent, Checkbox, Field, Input, Select } from "@sarhad/ui";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FormAlert, useFieldError } from "@/components/form-alert";
import type { ActionResult } from "@/lib/action-result";

import { deletePromo, savePromo } from "./actions";

export type PromoBranch = { id: string; name_en: string; name_ar: string };

export function PromoForm({
  id,
  initial,
  branches,
  allowAllBranches,
}: {
  id: string | null;
  initial: PromoInput;
  /** Branches this person may create codes for. */
  branches: PromoBranch[];
  /** Admins may make a code for every branch. */
  allowAllBranches: boolean;
}) {
  const t = useTranslations("promos");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const err = useFieldError(result);
  const set =
    (k: keyof PromoInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePromo(id, v);
      setResult(res);
      if (res.ok) router.push("/promotions");
    });
  }

  function remove() {
    if (!id || !confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deletePromo(id);
      setResult(res);
      if (res.ok) router.push("/promotions");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <FormAlert result={result} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field id="p-code" label={t("code")} hint={t("codeHint")} error={err("code")}>
            <Input
              id="p-code"
              dir="ltr"
              className="uppercase"
              value={v.code}
              onChange={set("code")}
              autoComplete="off"
            />
          </Field>
          <Field id="p-branch" label={t("branch")} error={err("branchId")}>
            <Select id="p-branch" value={v.branchId} onChange={set("branchId")}>
              {allowAllBranches ? <option value="">{t("allBranches")}</option> : null}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {localized(b, "name", locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="p-nameEn" label={t("nameEn")} hint={t("nameHint")} error={err("nameEn")}>
            <Input id="p-nameEn" dir="ltr" value={v.nameEn} onChange={set("nameEn")} />
          </Field>
          <Field id="p-nameAr" label={t("nameAr")} error={err("nameAr")}>
            <Input id="p-nameAr" dir="rtl" value={v.nameAr} onChange={set("nameAr")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="mb-1 text-sm font-medium">{t("kind")}</legend>
            <div className="flex flex-wrap gap-2">
              {PROMO_KINDS.map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary"
                >
                  <input
                    type="radio"
                    name="kind"
                    checked={v.kind === k}
                    onChange={() => setV((p) => ({ ...p, kind: k }))}
                    className="accent-[var(--color-primary)]"
                  />
                  {t(`kinds.${k}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {v.kind !== "free_delivery" ? (
            <Field
              id="p-value"
              label={v.kind === "percent" ? t("valuePercent") : t("valueFixed")}
              error={err("value")}
            >
              <Input
                id="p-value"
                dir="ltr"
                inputMode="decimal"
                value={v.value}
                onChange={set("value")}
              />
            </Field>
          ) : null}
          {v.kind === "percent" ? (
            <Field
              id="p-max"
              label={t("maxDiscount")}
              hint={t("optional")}
              error={err("maxDiscount")}
            >
              <Input
                id="p-max"
                dir="ltr"
                inputMode="decimal"
                value={v.maxDiscount}
                onChange={set("maxDiscount")}
              />
            </Field>
          ) : null}
          <Field
            id="p-min"
            label={t("minSubtotal")}
            hint={t("optional")}
            error={err("minSubtotal")}
          >
            <Input
              id="p-min"
              dir="ltr"
              inputMode="decimal"
              value={v.minSubtotal}
              onChange={set("minSubtotal")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field id="p-start" label={t("startsOn")} hint={t("optional")} error={err("startsOn")}>
            <Input
              id="p-start"
              type="date"
              dir="ltr"
              value={v.startsOn}
              onChange={set("startsOn")}
            />
          </Field>
          <Field id="p-end" label={t("endsOn")} hint={t("optional")} error={err("endsOn")}>
            <Input id="p-end" type="date" dir="ltr" value={v.endsOn} onChange={set("endsOn")} />
          </Field>
          <Field id="p-uses" label={t("maxUses")} hint={t("unlimited")} error={err("maxUses")}>
            <Input
              id="p-uses"
              dir="ltr"
              inputMode="numeric"
              value={v.maxUses}
              onChange={set("maxUses")}
            />
          </Field>
          <Field
            id="p-uses-customer"
            label={t("maxUsesPerCustomer")}
            hint={t("unlimited")}
            error={err("maxUsesPerCustomer")}
          >
            <Input
              id="p-uses-customer"
              dir="ltr"
              inputMode="numeric"
              value={v.maxUsesPerCustomer}
              onChange={set("maxUsesPerCustomer")}
            />
          </Field>
          <Checkbox
            label={t("firstOrderOnly")}
            checked={v.firstOrderOnly}
            onChange={(e) => setV((p) => ({ ...p, firstOrderOnly: e.target.checked }))}
          />
          <Checkbox
            label={t("isActive")}
            checked={v.isActive}
            onChange={(e) => setV((p) => ({ ...p, isActive: e.target.checked }))}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/promotions")}>
          {tc("back")}
        </Button>
        {id ? (
          <Button
            type="button"
            variant="destructive"
            className="ms-auto"
            onClick={remove}
            disabled={pending}
          >
            {tc("delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
