import { Button } from "@sarhad/ui";

import { signOut } from "@/app/[locale]/(auth)/actions";

export function SignOutButton({ label }: { label: string }) {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" size="sm">
        {label}
      </Button>
    </form>
  );
}
