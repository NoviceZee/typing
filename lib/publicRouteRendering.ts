import { getRouteSeoMetadata } from "@/lib/siteMetadata";

export function shouldRenderRouteWhileSettingsHydrate(pathname: string): boolean {
  return Boolean(getRouteSeoMetadata(pathname).canonicalPath) || pathname === "/feedback";
}
