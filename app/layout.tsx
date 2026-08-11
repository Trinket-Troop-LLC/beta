import type { Metadata, Viewport } from "next";
import { Geist, Gluten } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SerwistProvider } from "@/components/serwist-provider";
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
  themeColor: "#7c9272",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} ${gluten.variable}`}>
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
