import { getRouteSeoMetadata } from "@/lib/siteMetadata";

export function shouldRenderRouteWhileSettingsHydrate(pathname: string): boolean {
  return getRouteSeoMetadata(pathname).indexable || pathname === "/feedback";
}
