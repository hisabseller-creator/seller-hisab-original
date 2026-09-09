import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl, RESEARCH_AUTHOR_NAME, RESEARCH_AUTHOR_PATH, SEO_REVIEWED_AT } from "@/core/seo";
import { marketplaceHubs } from "@/core/seo-hubs";

export function generateStaticParams() {
  return Object.keys(marketplaceHubs).map((marketplace) => ({ marketplace }));
}

export async function generateMetadata({ params }: { params: Promise<{ marketplace: string }> }): Promise<Metadata> {
  const { marketplace } = await params;
  const config = marketplaceHubs[marketplace];
  if (!config) return {};
  const path = `/marketplaces/${config.slug}`;
  return {
    title: config.title,
    description: config.description,
    alternates: { canonical: path },
    openGraph: { title: config.title, description: config.description, url: path },
  };
}

export default async function MarketplaceHubPage({ params }: { params: Promise<{ marketplace: string }> }) {
  const { marketplace } = await params;
  const config = marketplaceHubs[marketplace];
  if (!config) notFound();
  const path = `/marketplaces/${config.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: config.title,
      description: config.description,
      url: absoluteUrl(path),
      dateModified: SEO_REVIEWED_AT,
      author: { "@type": "Organization", name: RESEARCH_AUTHOR_NAME, url: absoluteUrl(RESEARCH_AUTHOR_PATH) },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Marketplaces", item: absoluteUrl("/marketplaces") },
        { "@type": "ListItem", position: 3, name: config.title, item: absoluteUrl(path) },
      ],
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SeoContentPage config={config} parent={{ href: "/marketplaces", label: "Marketplaces" }} />
    </>
  );
}
