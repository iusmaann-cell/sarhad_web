"use client";

import type { AppRole } from "@sarhad/core";
import { Alert, Button, Field, Input } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { initialFormState, type FormState } from "@/lib/form-state";

import { assignRole, removeRole } from "./actions";

type AdminKey = Parameters<ReturnType<typeof useTranslations<"admin">>>[0];
type ValidationKey = Parameters<ReturnType<typeof useTranslations<"validation">>>[0];

function Message({ state }: { state: FormState }) {
  const t = useTranslations("admin");
  if (!state.message) return null;
  return (
    <Alert variant={state.status === "success" ? "success" : "destructive"}>
      {t(state.message as AdminKey)}
    </Alert>
  );
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AddStaffForm({
  roles,
  branches,
}: {
  roles: AppRole[];
  branches: { id: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("auth");
  const tv = useTranslations("validation");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(assignRole, initialFormState);
  const [role, setRole] = useState<AppRole>(roles.includes("staff") ? "staff" : roles[0]!);
  const needsBranch = role === "branch_manager" || role === "staff";
  const err = (k: string) =>
    state.fieldErrors?.[k] ? tv(state.fieldErrors[k] as ValidationKey) : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <Message state={state} />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <Field id="staff-email" label={ta("email")} error={err("email")}>
          <Input
            id="staff-email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={state.values?.email}
            required
          />
        </Field>
        <Field id="staff-role" label={t("staffRole")}>
          <select
            id="staff-role"
            name="role"
            className={selectClass}
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="staff-branch" label={t("staffBranch")} error={err("branchId")}>
          <select
            id="staff-branch"
            name="branchId"
            className={selectClass}
            disabled={!needsBranch}
            defaultValue=""
          >
            <option value="">{needsBranch ? "-" : tc("allBranches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("add")}
        </Button>
      </div>
    </form>
  );
}

export function RemoveRoleButton({ roleId }: { roleId: string }) {
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(removeRole, initialFormState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="roleId" value={roleId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {tc("remove")}
      </Button>
      {state.status === "error" ? <Message state={state} /> : null}
    </form>
  );
}
