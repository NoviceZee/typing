import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { FeedbackButton } from "@/components/FeedbackButton";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import { getShareImageUrl, getSiteUrl } from "@/lib/siteMetadata";
import "@/styles/globals.css";

const SITE_URL = getSiteUrl();
const SHARE_IMAGE_URL = getShareImageUrl();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>FormalType</title>
        <meta
          name="description"
          content="Custom typing practice for formal English, business writing, and tender-style passages."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#070807" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="FormalType" />
        <meta property="og:title" content="FormalType — Deliberate typing practice" />
        <meta property="og:description" content="Build speed and accuracy with writing that resembles real work." />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={SHARE_IMAGE_URL} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={SHARE_IMAGE_URL} />
        <link rel="icon" href="/favicon.svg" />
      </Head>
      <SiteTelemetry />
      <ThemeProvider>
        <AuthProvider>
          <AppErrorBoundary><Component {...pageProps} /><FeedbackButton /></AppErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
