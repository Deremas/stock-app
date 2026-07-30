import type { Metadata } from "next";

import { Providers } from "@/components/app-shell/providers";
import { APP_NAME } from "@/lib/branding";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Stock, sales, purchasing, and finance management for accessories and everyday essentials.",
  icons: {
    icon: "/brand/sam-tech-hub-mark.png",
    apple: "/brand/sam-tech-hub-mark.png",
  },
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
