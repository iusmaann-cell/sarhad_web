"use client";

import { MENU_IMAGES_BUCKET, menuImageUrl } from "@sarhad/core";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@sarhad/ui";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { FormAlert, useFieldError } from "@/components/form-alert";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/client";

import { deleteItem, saveItem } from "./actions";

type OptionValues = { id?: string; nameEn: string; nameAr: string; price: string };
type GroupValues = {
  id?: string;
  nameEn: string;
  nameAr: string;
  minSelect: string;
  maxSelect: string;
  options: OptionValues[];
};

export type ItemValues = {
  categoryId: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: string;
  calories: string;
  imagePath: string;
  sortOrder: string;
  isActive: boolean;
  isFeatured: boolean;
  modifierGroups: GroupValues[];
};

const newOption = (): OptionValues => ({ nameEn: "", nameAr: "", price: "0" });
const newGroup = (): GroupValues => ({
  nameEn: "",
  nameAr: "",
  minSelect: "0",
  maxSelect: "1",
  options: [newOption()],
});

export function ItemForm({
  id,
  initial,
  categories,
}: {
  id: string | null;
  initial: ItemValues;
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const err = useFieldError(result);

  const set = <K extends keyof ItemValues>(k: K, value: ItemValues[K]) =>
    setV((p) => ({ ...p, [k]: value }));
  const setGroup = (gi: number, patch: Partial<GroupValues>) =>
    set(
      "modifierGroups",
      v.modifierGroups.map((g, i) => (i === gi ? { ...g, ...patch } : g)),
    );
  const setOption = (gi: number, oi: number, patch: Partial<OptionValues>) =>
    setGroup(gi, {
      options: v.modifierGroups[gi]!.options.map((o, i) => (i === oi ? { ...o, ...patch } : o)),
    });

  async function upload(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `items/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from(MENU_IMAGES_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    setUploading(false);
    if (error) setResult({ ok: false, message: "uploadFailed" });
    else set("imagePath", path);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveItem(id, v);
      setResult(res);
      if (res.ok) router.push("/menu");
    });
  }

  function remove() {
    if (!id || !confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteItem(id);
      setResult(res);
      if (res.ok) router.push("/menu");
    });
  }

  const preview = menuImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", v.imagePath);

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <FormAlert result={result} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field id="i-categoryId" label={t("category")} error={err("categoryId")}>
            <Select
              id="i-categoryId"
              value={v.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="i-price" label={t("price")} error={err("price")}>
            <Input
              id="i-price"
              dir="ltr"
              inputMode="decimal"
              value={v.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="2.250"
            />
          </Field>
          <Field id="i-nameEn" label={t("nameEn")} error={err("nameEn")}>
            <Input
              id="i-nameEn"
              dir="ltr"
              value={v.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
            />
          </Field>
          <Field id="i-nameAr" label={t("nameAr")} error={err("nameAr")}>
            <Input
              id="i-nameAr"
              dir="rtl"
              value={v.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
            />
          </Field>
          <Field id="i-descriptionEn" label={t("descriptionEn")}>
            <Textarea
              id="i-descriptionEn"
              dir="ltr"
              value={v.descriptionEn}
              onChange={(e) => set("descriptionEn", e.target.value)}
            />
          </Field>
          <Field id="i-descriptionAr" label={t("descriptionAr")}>
            <Textarea
              id="i-descriptionAr"
              dir="rtl"
              value={v.descriptionAr}
              onChange={(e) => set("descriptionAr", e.target.value)}
            />
          </Field>
          <Field
            id="i-calories"
            label={`${t("calories")} (${tc("optional")})`}
            error={err("calories")}
          >
            <Input
              id="i-calories"
              dir="ltr"
              inputMode="numeric"
              value={v.calories}
              onChange={(e) => set("calories", e.target.value)}
            />
          </Field>
          <Field id="i-sortOrder" label={t("sortOrder")} error={err("sortOrder")}>
            <Input
              id="i-sortOrder"
              type="number"
              min={0}
              dir="ltr"
              value={v.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-6 md:col-span-2">
            <Checkbox
              label={t("isActive")}
              checked={v.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            <Checkbox
              label={t("featured")}
              checked={v.isFeatured}
              onChange={(e) => set("isFeatured", e.target.checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("photo")}</CardTitle>
          <CardDescription>{t("photoHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-28 rounded-lg object-cover" />
          ) : (
            <div
              className="flex size-28 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              aria-hidden
            >
              <ImagePlus />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label={t("uploadPhoto")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? tc("loading") : t("uploadPhoto")}
            </Button>
            {v.imagePath ? (
              <Button type="button" variant="ghost" onClick={() => set("imagePath", "")}>
                {t("removePhoto")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("modifiers")}</CardTitle>
          <CardDescription>{t("modifiersHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {v.modifierGroups.map((g, gi) => (
            <fieldset key={g.id ?? `new-${gi}`} className="grid gap-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">
                {t("groupName")} {gi + 1}
              </legend>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_7rem_7rem]">
                <Field
                  id={`g${gi}-en`}
                  label={t("nameEn")}
                  error={err(`modifierGroups.${gi}.nameEn`)}
                >
                  <Input
                    id={`g${gi}-en`}
                    dir="ltr"
                    value={g.nameEn}
                    onChange={(e) => setGroup(gi, { nameEn: e.target.value })}
                  />
                </Field>
                <Field
                  id={`g${gi}-ar`}
                  label={t("nameAr")}
                  error={err(`modifierGroups.${gi}.nameAr`)}
                >
                  <Input
                    id={`g${gi}-ar`}
                    dir="rtl"
                    value={g.nameAr}
                    onChange={(e) => setGroup(gi, { nameAr: e.target.value })}
                  />
                </Field>
                <Field
                  id={`g${gi}-min`}
                  label={t("minSelect")}
                  error={err(`modifierGroups.${gi}.minSelect`)}
                >
                  <Input
                    id={`g${gi}-min`}
                    type="number"
                    min={0}
                    dir="ltr"
                    value={g.minSelect}
                    onChange={(e) => setGroup(gi, { minSelect: e.target.value })}
                  />
                </Field>
                <Field
                  id={`g${gi}-max`}
                  label={t("maxSelect")}
                  error={err(`modifierGroups.${gi}.maxSelect`)}
                >
                  <Input
                    id={`g${gi}-max`}
                    type="number"
                    min={1}
                    dir="ltr"
                    value={g.maxSelect}
                    onChange={(e) => setGroup(gi, { maxSelect: e.target.value })}
                  />
                </Field>
              </div>
              {err(`modifierGroups.${gi}.options`) ? (
                <p className="text-sm text-destructive">{err(`modifierGroups.${gi}.options`)}</p>
              ) : null}
              {g.options.map((o, oi) => (
                <div
                  key={o.id ?? `new-${oi}`}
                  className="grid gap-2 md:grid-cols-[1fr_1fr_8rem_auto] md:items-end"
                >
                  <Field
                    id={`g${gi}o${oi}-en`}
                    label={`${t("optionName")} (EN)`}
                    error={err(`modifierGroups.${gi}.options.${oi}.nameEn`)}
                  >
                    <Input
                      id={`g${gi}o${oi}-en`}
                      dir="ltr"
                      value={o.nameEn}
                      onChange={(e) => setOption(gi, oi, { nameEn: e.target.value })}
                    />
                  </Field>
                  <Field
                    id={`g${gi}o${oi}-ar`}
                    label={`${t("optionName")} (AR)`}
                    error={err(`modifierGroups.${gi}.options.${oi}.nameAr`)}
                  >
                    <Input
                      id={`g${gi}o${oi}-ar`}
                      dir="rtl"
                      value={o.nameAr}
                      onChange={(e) => setOption(gi, oi, { nameAr: e.target.value })}
                    />
                  </Field>
                  <Field
                    id={`g${gi}o${oi}-price`}
                    label={t("extraPrice")}
                    error={err(`modifierGroups.${gi}.options.${oi}.price`)}
                  >
                    <Input
                      id={`g${gi}o${oi}-price`}
                      dir="ltr"
                      inputMode="decimal"
                      value={o.price}
                      onChange={(e) => setOption(gi, oi, { price: e.target.value })}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={tc("remove")}
                    onClick={() => setGroup(gi, { options: g.options.filter((_, i) => i !== oi) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGroup(gi, { options: [...g.options, newOption()] })}
                >
                  <Plus /> {t("addOption")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set(
                      "modifierGroups",
                      v.modifierGroups.filter((_, i) => i !== gi),
                    )
                  }
                >
                  <Trash2 /> {t("removeGroup")}
                </Button>
              </div>
            </fieldset>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => set("modifierGroups", [...v.modifierGroups, newGroup()])}
            >
              <Plus /> {t("addGroup")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || uploading}>
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
