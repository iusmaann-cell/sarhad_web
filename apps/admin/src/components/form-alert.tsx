"use client";

import { Alert } from "@sarhad/ui";
import { useTranslations } from "next-intl";

import type { ActionResult } from "@/lib/action-result";

type AdminKey = Parameters<ReturnType<typeof useTranslations<"admin">>>[0];

export function FormAlert({ result }: { result: ActionResult | null }) {
  const t = useTranslations("admin");
  if (!result?.message) return null;
  return (
    <Alert variant={result.ok ? "success" : "destructive"}>{t(result.message as AdminKey)}</Alert>
  );
}

export function useFieldError(result: ActionResult | null) {
  const tv = useTranslations("validation");
  return (path: string) => {
    const key = result?.fieldErrors?.[path];
    return key ? tv(key as Parameters<typeof tv>[0]) : undefined;
  };
}
