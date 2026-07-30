import type { Metadata } from "next";

import { Providers } from "@/components/app-shell/providers";
import { APP_NAME } from "@/lib/branding";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Stock, sales, purchasing, and finance management for phone and laptop accessories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="light"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
