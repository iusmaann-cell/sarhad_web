/** Result of an auth form Server Action. Messages are i18n keys. */
export type FormState = {
  status: "idle" | "error" | "success";
  /** Key in the "auth" namespace. */
  message?: string;
  /** Field name -> key in the "validation" namespace. */
  fieldErrors?: Record<string, string>;
  /** Echo of non-secret inputs so the form keeps them after an error. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

/** Only allow same-site relative redirects like "/account". */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/") {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}
