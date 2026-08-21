import type { Metadata, Viewport } from "next";
import { Geist, Gluten, Inter } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { SerwistProvider } from "@serwist/turbopack/react";
import { getAppUrl } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: "Trinket Troop",
  description:
    "Join the Trinket Troop waiting list for a friendlier way to buy, sell, trade, and gift secondhand treasures in New York City.",
  openGraph: {
    title: "Trinket Troop",
    description:
      "Join the waiting list for a friendlier way to exchange secondhand treasures in New York City.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trinket Troop",
    description:
      "Join the waiting list for a friendlier way to exchange secondhand treasures in New York City.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trinket Troop",
  },
};

export const viewport: Viewport = {
  themeColor: "#877c27",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

const gluten = Gluten({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-gluten",
});

const sophieChalk = localFont({
  src: "./fonts/Sophiechalk-Regular.ttf",
  display: "swap",
  variable: "--font-sophie-chalk",
});

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} ${gluten.variable} ${inter.variable} ${sophieChalk.variable}`}>
        <SerwistProvider swUrl="/serwist/sw.js">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
