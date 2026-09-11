import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SeoToolPage } from "@/components/seo-tool-page";
import { allSeoPages } from "@/core/all-seo-pages";
import { calculatorEntryForSlug } from "@/core/marketplace-calculators";
import { universalCalculatorHrefForKind } from "@/core/universal-calculators";
import { absoluteUrl } from "@/core/seo";

function calculatorRedirect(slug: string) {
  const legacy = calculatorEntryForSlug(slug);
  return legacy ? universalCalculatorHrefForKind(legacy.kind) : null;
}

export function generateStaticParams() {
  return Object.keys(allSeoPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const redirectHref = calculatorRedirect(slug);
  if (redirectHref) {
    return {
      alternates: { canonical: redirectHref },
      robots: { index: false, follow: true },
    };
  }

  const config = allSeoPages[slug];
  if (!config) return {};
  const path = `/${config.slug}`;
  return {
    title: config.title,
    description: config.description,
    alternates: { canonical: path },
    openGraph: { title: config.title, description: config.description, url: path },
    twitter: { card: "summary_large_image", title: config.title, description: config.description },
  };
}

export default async function SeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const redirectHref = calculatorRedirect(slug);
  if (redirectHref) redirect(redirectHref);

  const config = allSeoPages[slug];
  if (!config) notFound();
  const path = `/${config.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Calculators", item: absoluteUrl("/calculators") },
        { "@type": "ListItem", position: 3, name: config.title, item: absoluteUrl(path) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: config.title,
      description: config.description,
      url: absoluteUrl(path),
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: config.faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SeoToolPage config={config} />
    </>
  );
}
