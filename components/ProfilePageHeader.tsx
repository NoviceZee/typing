import React from "react";
import { ProfileSectionNav } from "@/components/ProfileSectionNav";

export function ProfilePageHeader() {
  return (
    <header className="profile-page-header">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-brass">Profile</p>
      <ProfileSectionNav />
    </header>
  );
}
