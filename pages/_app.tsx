import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { FeedbackButton } from "@/components/FeedbackButton";
import { SiteTelemetry } from "@/components/SiteTelemetry";
import "@/styles/globals.css";

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
        <meta property="og:image" content="/formaltype-share.svg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/formaltype-share.svg" />
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
