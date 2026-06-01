import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "@/components/AuthProvider";
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
      </Head>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}
