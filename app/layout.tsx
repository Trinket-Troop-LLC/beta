import type { Metadata } from "next";
import { Geist, Gluten } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Trinket Troop",
  description:
    "Join the Trinket Troop waiting list for a friendlier way to buy, sell, trade, and gift secondhand treasures in New York City.",
  openGraph: {
    title: "Trinket Troop",
    description:
      "Join the waiting list for a friendlier way to exchange secondhand treasures in New York City.",
    images: [
      {
        url: "/og-waitlist.png",
        width: 1200,
        height: 630,
        alt: "Trinket Troop — Join the waiting list",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trinket Troop",
    description:
      "Join the waiting list for a friendlier way to exchange secondhand treasures in New York City.",
    images: ["/og-waitlist.png"],
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
