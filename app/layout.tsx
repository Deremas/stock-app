import type { Metadata } from "next";

import { Providers } from "@/components/app-shell/providers";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Stock Management App",
  description: "Multi-branch stock management app for electronics accessories",
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
