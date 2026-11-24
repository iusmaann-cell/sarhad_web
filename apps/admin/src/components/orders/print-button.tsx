"use client";

import { Button } from "@sarhad/ui";
import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer /> {label}
    </Button>
  );
}
