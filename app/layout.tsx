import { headers } from "next/headers";
import type { Metadata } from "next";
import "./globals.css";
import "../components/marketplace-responsive.css";
import { AdminReauthentication } from "@/components/admin-reauthentication";
import { WebVitals } from "@/components/web-vitals";
import { Providers } from "@/components/providers";
import { SITE_URL } from "@/core/site-url";
import { BRAND_DESCRIPTION, absoluteUrl } from "@/core/seo";
import { getPublicSeoSettings } from "@/server/seo-settings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPublicSeoSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "SellerHisab – Profit & Margin Analytics for Online Sellers",
      template: "%s | SellerHisab",
    },
    description: BRAND_DESCRIPTION,
    applicationName: "SellerHisab",
    keywords: ["seller margin", "multi marketplace analytics", "Amazon seller profit", "Flipkart seller profit", "Meesho profit calculator", "SKU contribution", "settlement checker"],
    authors: [{ name: "SellerHisab" }],
    creator: "SellerHisab",
    openGraph: {
      type: "website",
      siteName: seo.identity.publicationName,
      title: "SellerHisab – Profit & Margin Analytics for Online Sellers",
      description: BRAND_DESCRIPTION,
      url: SITE_URL,
      images: [{ url: seo.identity.defaultSocialImageUrl || "/og.svg", width: 1200, height: 630, alt: "SellerHisab — Know your real margin." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "SellerHisab",
      description: "Marketplace seller profit, settlement, RTO, break-even and SKU decision intelligence.",
      images: [seo.identity.defaultSocialImageUrl || "/og.svg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": seo.discovery.discoverLargeImages ? "large" : "standard",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification: {
      google: seo.verification.googleSiteVerification || undefined,
      other: seo.verification.bingSiteVerification ? { "msvalidate.01": seo.verification.bingSiteVerification } : undefined,
    },
    alternates: seo.discovery.rssEnabled ? { types: { "application/rss+xml": `${SITE_URL}/feed.xml` } } : undefined,
    icons: {
      icon: [
        { url: "/sellerhisab-favicon-64.png", sizes: "64x64", type: "image/png" },
        { url: "/sellerhisab-favicon-512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const seo = await getPublicSeoSettings();
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: seo.identity.publisherName,
      url: SITE_URL,
      logo: absoluteUrl(seo.identity.organizationLogoUrl || "/sellerhisab-mark-512.png"),
      description: seo.identity.organizationDescription,
      sameAs: seo.identity.sameAs,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: seo.identity.publicationName,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: seo.future.defaultLocale,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "SellerHisab",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: BRAND_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ];

  return (
    <html lang={(await headers()).get("x-sellerhisab-locale") || seo.future.defaultLocale}>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <Providers>{children}<WebVitals /><AdminReauthentication /></Providers>
      </body>
    </html>
  );
}
