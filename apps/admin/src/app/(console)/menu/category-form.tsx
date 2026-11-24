"use client";

import { Button, Card, CardContent, Checkbox, Field, Input, Textarea } from "@sarhad/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FormAlert, useFieldError } from "@/components/form-alert";
import type { ActionResult } from "@/lib/action-result";

import { deleteCategory, saveCategory } from "./actions";

export type CategoryValues = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  sortOrder: string;
  isActive: boolean;
};

export function CategoryForm({ id, initial }: { id: string | null; initial: CategoryValues }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const err = useFieldError(result);
  const set =
    (k: keyof CategoryValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveCategory(id, v);
      setResult(res);
      if (res.ok) router.push("/menu");
    });
  }

  function remove() {
    if (!id || !confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteCategory(id);
      setResult(res);
      if (res.ok) router.push("/menu");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <FormAlert result={result} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field id="c-nameEn" label={t("nameEn")} error={err("nameEn")}>
            <Input id="c-nameEn" dir="ltr" value={v.nameEn} onChange={set("nameEn")} />
          </Field>
          <Field id="c-nameAr" label={t("nameAr")} error={err("nameAr")}>
            <Input id="c-nameAr" dir="rtl" value={v.nameAr} onChange={set("nameAr")} />
          </Field>
          <Field id="c-descriptionEn" label={t("descriptionEn")}>
            <Textarea
              id="c-descriptionEn"
              dir="ltr"
              value={v.descriptionEn}
              onChange={set("descriptionEn")}
            />
          </Field>
          <Field id="c-descriptionAr" label={t("descriptionAr")}>
            <Textarea
              id="c-descriptionAr"
              dir="rtl"
              value={v.descriptionAr}
              onChange={set("descriptionAr")}
            />
          </Field>
          <Field id="c-sortOrder" label={t("sortOrder")} error={err("sortOrder")}>
            <Input
              id="c-sortOrder"
              type="number"
              min={0}
              dir="ltr"
              value={v.sortOrder}
              onChange={set("sortOrder")}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label={t("isActive")}
              checked={v.isActive}
              onChange={(e) => setV((p) => ({ ...p, isActive: e.target.checked }))}
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/menu")}>
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
