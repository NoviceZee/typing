import React from "react";
import { PageContainer } from "@/components/PageLayout";
import { ProfilePageHeader } from "@/components/ProfilePageHeader";

export function ProfilePageLayout({ children }: React.PropsWithChildren) {
  return <PageContainer><ProfilePageHeader />{children}</PageContainer>;
}
