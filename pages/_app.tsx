import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
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
      <ThemeProvider>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
