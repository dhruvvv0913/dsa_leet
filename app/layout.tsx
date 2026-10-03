import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Montserrat } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { site, THEME_STORAGE_KEY } from "@/lib/site";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
// Montserrat is close to the logo's wordmark; used for the wordmark and page titles.
const display = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: `${site.name} · ${site.product}`, template: `%s · ${site.name}` },
  description: site.description,
  // Private, invite-only cohort: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1120",
};

// Dark is the default. This applies a saved choice before first paint, so anyone who
// switched to light never sees a dark flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${mono.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
