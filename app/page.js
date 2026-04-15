import LandingPageClient from "./LandingPageClient";

const siteUrl =
  (typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.trim()) ||
  "https://insightbooksafrica.com";

const homeDescription =
  "Run invoicing, expenses, inventory, POS, payroll, and financial reporting in one secure cloud platform. Built for businesses in Malawi and across Africa — free trial, local support.";

/** Homepage overrides root defaults for clearer search snippets on the canonical URL. */
export const metadata = {
  title: "InsightBooks — Accounting, Inventory & POS for African Businesses",
  description: homeDescription,
  openGraph: {
    title: "InsightBooks — Accounting, Inventory & POS for African Businesses",
    description: homeDescription,
    url: siteUrl.replace(/\/$/, ""),
    type: "website",
  },
  twitter: {
    title: "InsightBooks — Accounting, Inventory & POS for African Businesses",
    description: homeDescription,
  },
  alternates: {
    canonical: siteUrl.replace(/\/$/, ""),
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "InsightBooks",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free trial available",
  },
  description: homeDescription,
  url: siteUrl.replace(/\/$/, ""),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPageClient />
    </>
  );
}
