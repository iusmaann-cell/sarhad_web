import { fieldErrors } from "@sarhad/core";
import { useState } from "react";
import type { z } from "zod";

import type { MessageKey } from "./i18n";

/** Validate with a shared zod schema; errors are message keys. */
export function useForm<S extends z.ZodType>(schema: S, initial: Record<string, string>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});

  const set = (name: string) => (text: string) => setValues((v) => ({ ...v, [name]: text }));

  const validate = (): z.infer<S> | null => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const out: Record<string, MessageKey> = {};
    for (const [k, v] of Object.entries(fieldErrors(parsed.error)))
      out[k] = `validation.${v}` as MessageKey;
    setErrors(out);
    return null;
  };

  return { values, errors, set, validate };
}
