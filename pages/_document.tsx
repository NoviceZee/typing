import { Head, Html, Main, NextScript } from "next/document";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeBootstrap";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script
          id="typing-station-theme"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
