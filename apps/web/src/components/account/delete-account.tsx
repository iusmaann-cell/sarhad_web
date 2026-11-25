"use client";

import { Alert, Button, Checkbox } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { deleteAccount } from "@/app/[locale]/account/actions";

/** "Delete my account" with a confirmation step (required by the app stores). */
export function DeleteAccount() {
  const t = useTranslations("account");
  const dialog = useRef<HTMLDialogElement>(null);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        onClick={() => {
          setSure(false);
          setError(null);
          dialog.current?.showModal();
        }}
      >
        {t("deleteAccount")}
      </Button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        aria-label={t("deleteAccount")}
      >
        <div className="grid gap-4 p-5">
          <h2 className="text-lg font-semibold">{t("deleteTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("deleteBody")}</p>
          <Checkbox
            label={t("deleteConfirm")}
            checked={sure}
            onChange={(e) => setSure(e.target.checked)}
          />
          {error ? (
            <Alert variant="destructive">
              {t(`deleteErrors.${error}` as Parameters<typeof t>[0])}
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
              {t("keepAccount")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!sure || pending}
              data-testid="confirm-delete-account"
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteAccount();
                  if (res.ok) {
                    // Full reload so every part of the page forgets the session.
                    const home = window.location.pathname.startsWith("/en") ? "/en" : "/";
                    window.location.replace(new URL(`${home}?deleted=1`, window.location.origin));
                  } else setError(res.error);
                })
              }
            >
              {t("deleteForever")}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
