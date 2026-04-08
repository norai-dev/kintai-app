"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(dashboard)/actions/auth";

export function LogoutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut()}>
      ログアウト
    </Button>
  );
}
