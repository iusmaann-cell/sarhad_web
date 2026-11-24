/** What admin Server Actions return. Keys are i18n keys. */
export type ActionResult = {
  ok: boolean;
  /** Key in the "admin" namespace. */
  message?: string;
  /** Field path -> key in the "validation" namespace. */
  fieldErrors?: Record<string, string>;
  id?: string;
};

export function dbErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "notAllowed";
  if (error.code === "23503") return "categoryNotEmpty";
  return "notAllowed";
}
