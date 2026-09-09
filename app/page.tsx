import type { Metadata } from "next";
import { WebsiteLanding as LandingPage } from "@/components/website-landing";
import { publicFaqs } from "@/core/content";
import { BRAND_DESCRIPTION, absoluteUrl } from "@/core/seo";
import { getPricing } from "@/server/pricing";
import { getPublicSiteSettings } from "@/server/site-settings";
import { socialHref } from "@/core/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SellerHisab – Profit & Margin Analytics for Online Sellers",
  description: "SellerHisab helps online sellers understand real earnings, settlements, returns, RTO, product costs and profit risk from supported marketplace reports.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const pricing = getPricing();
  const settings = await getPublicSiteSettings();
  const sameAs = settings.contact.socialLinks
    .map((item) => socialHref(item.platform, item.value))
    .filter(Boolean);
  if (settings.contact.instagramHandle && !settings.contact.socialLinks.some((item) => item.platform === "instagram")) {
    sameAs.unshift(`https://instagram.com/${settings.contact.instagramHandle.replace(/^@/, "")}`);
  }
  const contactPoint = settings.contact.supportEmail || settings.contact.phoneNumber
    ? [{
        "@type": "ContactPoint",
        email: settings.contact.supportEmail || undefined,
        telephone: settings.contact.phoneNumber || undefined,
        contactType: "customer support",
        areaServed: "IN",
      }]
    : undefined;

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absoluteUrl("/")}#organization`,
    name: "SellerHisab",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/sellerhisab-favicon-512.png"),
    description: BRAND_DESCRIPTION,
    sameAs: sameAs.length ? sameAs : undefined,
    contactPoint,
  };

  const structuredData = [
    organization,
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: "SellerHisab",
      url: absoluteUrl("/"),
      description: BRAND_DESCRIPTION,
      publisher: { "@id": `${absoluteUrl("/")}#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${absoluteUrl("/")}#software`,
      name: "SellerHisab",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      provider: { "@id": `${absoluteUrl("/")}#organization` },
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "INR", name: "Free Check", url: absoluteUrl("/analyze") },
        { "@type": "Offer", price: String(pricing.actionReportPaise / 100), priceCurrency: "INR", name: "Action Report", url: absoluteUrl("/pricing") },
        { "@type": "Offer", price: String(pricing.starterMonthlyPaise / 100), priceCurrency: "INR", name: "Starter Monthly", url: absoluteUrl("/pricing") },
        { "@type": "Offer", price: String(pricing.proMonthlyPaise / 100), priceCurrency: "INR", name: "Pro Monthly", url: absoluteUrl("/pricing") },
      ],
      description: BRAND_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: publicFaqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <LandingPage pricing={pricing} />
    </>
  );
}
