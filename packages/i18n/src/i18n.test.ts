import { describe, expect, it } from "vitest";

import { getDirection, localized, messages } from "./index";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(messages.ar).sort()).toEqual(keys(messages.en).sort());
  });

  it("has no empty strings", () => {
    for (const locale of ["ar", "en"] as const) {
      const flat = JSON.stringify(messages[locale]);
      expect(flat).not.toContain('""');
    }
  });
});

describe("helpers", () => {
  it("Arabic is right to left", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
  });

  it("falls back to the other language", () => {
    expect(localized({ name_ar: "سرحد", name_en: "Sarhad" }, "name", "en")).toBe("Sarhad");
    expect(localized({ name_ar: null, name_en: "Sarhad" }, "name", "ar")).toBe("Sarhad");
  });
});
