import Head from "next/head";
import React from "react";
import {
  getCanonicalUrl,
  getRouteSeoMetadata,
  getShareImageUrl,
  getWebsiteStructuredData,
  getWebApplicationStructuredData
} from "@/lib/siteMetadata";
import { supabaseOrigin } from "@/lib/supabaseClient";

interface SiteMetadataProps {
  pathname: string;
  siteUrl?: string;
}

export function SiteMetadata({ pathname, siteUrl }: SiteMetadataProps) {
  const metadata = getRouteSeoMetadata(pathname);
  const canonicalUrl = getCanonicalUrl(pathname, siteUrl);
  const shareImageUrl = getShareImageUrl(siteUrl);
  const isHomepage = metadata.canonicalPath === "/";
  const webApplicationStructuredData = isHomepage
    ? JSON.stringify(getWebApplicationStructuredData(siteUrl)).replace(/</g, "\\u003c")
    : null;
  const websiteStructuredData = isHomepage
    ? JSON.stringify(getWebsiteStructuredData(siteUrl)).replace(/</g, "\\u003c")
    : null;

  return (
    <Head>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta name="robots" content={metadata.indexable ? "index, follow" : "noindex, nofollow"} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#070807" />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {canonicalUrl && <meta property="og:type" content="website" />}
      {canonicalUrl && <meta property="og:site_name" content="Typing Station" />}
      {canonicalUrl && <meta property="og:title" content={metadata.title} />}
      {canonicalUrl && <meta property="og:description" content={metadata.description} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {canonicalUrl && <meta property="og:image" content={shareImageUrl} />}
      {canonicalUrl && <meta property="og:image:type" content="image/png" />}
      {canonicalUrl && <meta property="og:image:width" content="1200" />}
      {canonicalUrl && <meta property="og:image:height" content="630" />}
      {canonicalUrl && <meta name="twitter:card" content="summary_large_image" />}
      {canonicalUrl && <meta name="twitter:title" content={metadata.title} />}
      {canonicalUrl && <meta name="twitter:description" content={metadata.description} />}
      {canonicalUrl && <meta name="twitter:image" content={shareImageUrl} />}
      {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />}
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
      <link rel="icon" href="/favicon-48x48.png" type="image/png" sizes="48x48" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
      <link rel="manifest" href="/site.webmanifest" />
      {webApplicationStructuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: webApplicationStructuredData }} />}
      {websiteStructuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteStructuredData }} />}
    </Head>
  );
}
