import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketplaceHubExperience } from "@/components/marketplace-hub-experience";
import { marketplaceDefinition, type MarketplaceExperienceId } from "@/core/marketplace-definitions";
import { marketplaceHubs } from "@/core/marketplace-content";
import { absoluteUrl, RESEARCH_AUTHOR_NAME, RESEARCH_AUTHOR_PATH, SEO_REVIEWED_AT } from "@/core/seo";

export function generateStaticParams() {
  return Object.keys(marketplaceHubs).map((marketplace) => ({ marketplace }));
}

export async function generateMetadata({ params }: { params: Promise<{ marketplace: string }> }): Promise<Metadata> {
  const { marketplace } = await params;
  const config = marketplaceHubs[marketplace];
  const definition = marketplaceDefinition(marketplace);
  if (!config || !definition) return {};
  const path = `/marketplaces/${config.slug}`;
  return {
    title: `${definition.name} Seller Hub`,
    description: `Use SellerHisab ${definition.name} analysis, supported connection tools, guides and calculators from one marketplace hub.`,
    alternates: { canonical: path },
    openGraph: { title: `${definition.name} Seller Hub`, description: config.description, url: path },
  };
}

export default async function MarketplaceHubPage({ params }: { params: Promise<{ marketplace: string }> }) {
  const { marketplace } = await params;
  const config = marketplaceHubs[marketplace];
  const definition = marketplaceDefinition(marketplace);
  if (!config || !definition) notFound();
  const path = `/marketplaces/${config.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${definition.name} Seller Hub`,
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
        { "@type": "ListItem", position: 3, name: definition.name, item: absoluteUrl(path) },
      ],
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <MarketplaceHubExperience marketplaceId={definition.id as MarketplaceExperienceId} />
    </>
  );
}
