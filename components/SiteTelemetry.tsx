import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";

declare global { interface Window { gtag?: (...args: unknown[]) => void; } }

export function SiteTelemetry() {
  const router = useRouter();
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!measurementId) return;
    const track = (url: string) => window.gtag?.("config", measurementId, { page_path: url });
    router.events.on("routeChangeComplete", track);
    return () => router.events.off("routeChangeComplete", track);
  }, [measurementId, router.events]);

  if (!measurementId) return null;
  return <><Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" /><Script id="formaltype-ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${measurementId}',{page_path:window.location.pathname});`}</Script></>;
}
