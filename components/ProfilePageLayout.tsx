import React from "react";
import { ProfilePageHeader } from "@/components/ProfilePageHeader";

export function ProfilePageLayout({ children }: React.PropsWithChildren) {
  return <section className="mx-auto w-full max-w-6xl"><ProfilePageHeader />{children}</section>;
}
