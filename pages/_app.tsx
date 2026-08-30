import type { AppProps } from "next/app";
import { AuthProvider } from "@/components/AuthProvider";
import { AccountSettingsProvider } from "@/components/AccountSettingsProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { SiteMetadata } from "@/components/SiteMetadata";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import { AnalyticsConsentProvider } from "@/components/AnalyticsConsentProvider";
import { AnalyticsConsentNotice } from "@/components/AnalyticsConsentControls";
import { shouldRenderRouteWhileSettingsHydrate } from "@/lib/publicRouteRendering";
import "@/styles/globals.css";

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <AnalyticsConsentProvider>
      <SiteMetadata pathname={router.pathname} />
      <SiteTelemetry />
      <AuthProvider>
        <AccountSettingsProvider renderChildrenWhileHydrating={shouldRenderRouteWhileSettingsHydrate(router.pathname)}>
          <ThemeProvider>
          <AppErrorBoundary><Component {...pageProps} /></AppErrorBoundary>
          </ThemeProvider>
        </AccountSettingsProvider>
      </AuthProvider>
      <AnalyticsConsentNotice />
    </AnalyticsConsentProvider>
  );
}
