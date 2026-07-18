import React from "react";
import { useRouter } from "next/router";
import { PageHeader } from "@/components/PageLayout";
import { ProfileSectionNav } from "@/components/ProfileSectionNav";

export function ProfilePageHeader() {
  const router = useRouter();
  const title = router.pathname === "/profile/friends"
    ? "Friends"
    : router.pathname === "/profile/account"
      ? "Account"
      : "Profile & stats";

  return (
    <>
      <PageHeader eyebrow="Profile" title={title} />
      <ProfileSectionNav />
    </>
  );
}
