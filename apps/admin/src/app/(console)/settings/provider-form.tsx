"use client";

import { PAYMENT_PROVIDER_KINDS, type PaymentProviderKind } from "@sarhad/core";
import { Button, Checkbox, Field, Input, Select } from "@sarhad/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FormAlert, useFieldError } from "@/components/form-alert";
import type { ActionResult } from "@/lib/action-result";

import { deletePaymentProvider, savePaymentProvider } from "./actions";

export type ProviderValues = {
  kind: PaymentProviderKind;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  isLive: boolean;
  sortOrder: string;
};

const DEFAULT_NAMES: Record<PaymentProviderKind, [string, string]> = {
  myfatoorah: ["KNET or card", "كي نت أو بطاقة"],
  tap: ["KNET or card", "كي نت أو بطاقة"],
  test: ["Test payment", "دفع تجريبي"],
};

export function ProviderForm({
  id,
  initial,
  keyHint,
}: {
  id: string | null;
  initial?: ProviderValues;
  keyHint?: string | null;
}) {
  const t = useTranslations("payments");
  const router = useRouter();
  const [v, setV] = useState<ProviderValues>(
    initial ?? {
      kind: "myfatoorah",
      nameEn: DEFAULT_NAMES.myfatoorah[0],
      nameAr: DEFAULT_NAMES.myfatoorah[1],
      isActive: false,
      isLive: false,
      sortOrder: "0",
    },
  );
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const err = useFieldError(result);
  const p = id ?? "new";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePaymentProvider(id, { ...v, apiKey });
      setResult(res);
      if (res.ok) {
        setApiKey("");
        router.refresh();
      }
    });
  }

  function remove() {
    if (!id || !confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deletePaymentProvider(id);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormAlert result={result} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id={`${p}-kind`} label={t("kind")} hint={t(`kindHints.${v.kind}`)}>
          <Select
            id={`${p}-kind`}
            value={v.kind}
            disabled={!!id}
            onChange={(e) => {
              const kind = e.target.value as PaymentProviderKind;
              setV((x) => ({
                ...x,
                kind,
                nameEn: DEFAULT_NAMES[kind][0],
                nameAr: DEFAULT_NAMES[kind][1],
              }));
            }}
          >
            {PAYMENT_PROVIDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        {v.kind !== "test" ? (
          <Field
            id={`${p}-key`}
            label={t("apiKey")}
            hint={
              <>
                {keyHint ? `${t("keySaved", { hint: keyHint })} · ` : `${t("noKey")} · `}
                {t("apiKeyHint")}
              </>
            }
            error={err("apiKey")}
          >
            <Input
              id={`${p}-key`}
              type="password"
              dir="ltr"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Field>
        ) : (
          <div />
        )}
        <Field id={`${p}-nameEn`} label={t("nameEn")} error={err("nameEn")}>
          <Input
            id={`${p}-nameEn`}
            dir="ltr"
            value={v.nameEn}
            onChange={(e) => setV((x) => ({ ...x, nameEn: e.target.value }))}
          />
        </Field>
        <Field id={`${p}-nameAr`} label={t("nameAr")} error={err("nameAr")}>
          <Input
            id={`${p}-nameAr`}
            dir="rtl"
            value={v.nameAr}
            onChange={(e) => setV((x) => ({ ...x, nameAr: e.target.value }))}
          />
        </Field>
        <Checkbox
          label={t("isActive")}
          checked={v.isActive}
          onChange={(e) => setV((x) => ({ ...x, isActive: e.target.checked }))}
        />
        {v.kind !== "test" ? (
          <div className="grid gap-1">
            <Checkbox
              label={t("isLive")}
              checked={v.isLive}
              onChange={(e) => setV((x) => ({ ...x, isLive: e.target.checked }))}
            />
            <p className="text-xs text-muted-foreground">{t("isLiveHint")}</p>
          </div>
        ) : null}
        <Field id={`${p}-sort`} label={t("sortOrder")}>
          <Input
            id={`${p}-sort`}
            type="number"
            min={0}
            dir="ltr"
            className="w-24"
            value={v.sortOrder}
            onChange={(e) => setV((x) => ({ ...x, sortOrder: e.target.value }))}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {id ? (
          <Button
            type="button"
            variant="ghost"
            className="ms-auto text-destructive"
            onClick={remove}
            disabled={pending}
          >
            {t("delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
