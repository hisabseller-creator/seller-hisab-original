import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl, RESEARCH_AUTHOR_NAME, RESEARCH_AUTHOR_PATH, SEO_REVIEWED_AT } from "@/core/seo";
import { guidePages } from "@/core/seo-hubs";

export function generateStaticParams() {
  return Object.keys(guidePages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const config = guidePages[slug];
  if (!config) return {};
  const path = `/guides/${config.slug}`;
  return {
    title: config.title,
    description: config.description,
    alternates: { canonical: path },
    openGraph: { type: "article", title: config.title, description: config.description, url: path },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = guidePages[slug];
  if (!config) notFound();
  const path = `/guides/${config.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: config.title,
      description: config.description,
      mainEntityOfPage: absoluteUrl(path),
      dateModified: SEO_REVIEWED_AT,
      author: { "@type": "Organization", name: RESEARCH_AUTHOR_NAME, url: absoluteUrl(RESEARCH_AUTHOR_PATH) },
      publisher: { "@type": "Organization", name: "SellerHisab", url: absoluteUrl("/") },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Guides", item: absoluteUrl("/guides") },
        { "@type": "ListItem", position: 3, name: config.title, item: absoluteUrl(path) },
      ],
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SeoContentPage config={config} parent={{ href: "/guides", label: "Guides" }} />
    </>
  );
}
