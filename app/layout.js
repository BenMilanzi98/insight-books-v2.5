import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootLayoutClient from "./RootLayoutClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  (typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.trim()) ||
  "https://insightbooksafrica.com";

const defaultDescription =
  "Cloud accounting and business management for African companies: invoicing, expenses, inventory, POS, payroll, banking, and financial reports. Start your free trial.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "InsightBooks — Accounting, Inventory & POS for African Businesses",
    template: "%s | InsightBooks",
  },
  description: defaultDescription,
  keywords: [
    "InsightBooks",
    "accounting software Africa",
    "business management Malawi",
    "cloud accounting",
    "invoicing software",
    "inventory management",
    "POS software",
    "payroll Africa",
  ],
  authors: [{ name: "InsightBooks", url: siteUrl }],
  creator: "InsightBooks",
  publisher: "InsightBooks",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "InsightBooks",
    title: "InsightBooks — Accounting & Business Management",
    description: defaultDescription,
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "InsightBooks",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InsightBooks — Accounting & Business Management",
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
