import React from "react";
import { ChartNoAxesCombined, UserRoundCog, Users } from "lucide-react";
import { SectionTabs } from "@/components/SecondaryNavigation";

const PROFILE_SECTIONS = [
  { href: "/profile", label: "Stats", icon: ChartNoAxesCombined },
  { href: "/profile/friends", label: "Friends", icon: Users },
  { href: "/profile/account", label: "Account", icon: UserRoundCog }
];

export function ProfileSectionNav() {
  return <SectionTabs label="Profile sections" items={PROFILE_SECTIONS} className="mt-3" />;
}
