import type { Metadata } from "next";
import { Geist, Gluten } from "next/font/google";
import { ThemeProvider } from "next-themes";
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
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
