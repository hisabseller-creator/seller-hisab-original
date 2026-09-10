import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CapabilityState } from "@/core/marketplace-definitions";
import type { SeoContentConfig } from "@/core/seo-hubs";
import { PublicShell } from "./public-shell";

type ContentCapability = {
  label: string;
  detail: string;
  state: CapabilityState;
  href?: string;
};

type ContentBrand = {
  name: string;
  logo: string;
};

type ContentCta = {
  href: string;
  label: string;
};

const STATE_STYLES: Record<CapabilityState, string> = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-800",
  available: "border-blue-200 bg-blue-50 text-blue-800",
  "activation-required": "border-amber-200 bg-amber-50 text-amber-800",
  "not-available": "border-slate-200 bg-slate-100 text-slate-600",
};

export function SeoContentPage({
  config,
  parent,
  brand,
  capabilities,
  primaryCta = { href: "/analyze", label: "Analyze your own report" },
  secondaryCta,
}: {
  config: SeoContentConfig;
  parent: { href: string; label: string };
  brand?: ContentBrand;
  capabilities?: ContentCapability[];
  primaryCta?: ContentCta;
  secondaryCta?: ContentCta;
}) {
  return (
    <PublicShell>
      <main className="website-editorial">
        <section className="px-4 py-10 sm:px-6 md:py-16 lg:px-10">
          <div className="mx-auto max-w-[1040px]">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <Link href="/" className="hover:text-blue-700">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href={parent.href} className="hover:text-blue-700">{parent.label}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-slate-800">{config.title}</span>
            </nav>

            {brand ? (
              <div className="mt-8 flex min-h-14 items-center">
                <Image src={brand.logo} alt={`${brand.name} logo`} width={210} height={60} className="max-h-12 w-auto max-w-[210px] object-contain object-left" />
              </div>
            ) : null}

            <p className={`eyebrow ${brand ? "mt-5" : "mt-8"}`}>{config.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-balance text-4xl font-black leading-tight tracking-[-.045em] text-slate-950 sm:text-5xl">{config.headline}</h1>

            {capabilities?.length ? (
              <section className="mt-7 grid gap-3 sm:grid-cols-2" aria-label={`${brand?.name ?? "Marketplace"} support status`}>
                {capabilities.map((capability) => {
                  const card = (
                    <div className="h-full rounded-2xl border border-white/80 bg-white/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{capability.label}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${STATE_STYLES[capability.state]}`}>
                          {capability.state === "live" ? "LIVE" : capability.state === "available" ? "AVAILABLE" : capability.state === "activation-required" ? "AUTH REQUIRED" : "NOT CLAIMED"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{capability.detail}</p>
                    </div>
                  );
                  return capability.href ? <Link key={capability.label} href={capability.href} className="block transition hover:-translate-y-0.5">{card}</Link> : <div key={capability.label}>{card}</div>;
                })}
              </section>
            ) : null}

            <section className="liquid-panel mt-8 rounded-[26px] p-6 sm:p-8" aria-labelledby="direct-answer">
              <h2 id="direct-answer" className="mt-2 text-xl font-black tracking-[-.02em] text-slate-950">The short version</h2>
              <p className="mt-4 text-base leading-7 text-slate-700">{config.directAnswer}</p>
            </section>

            <article className="liquid-panel mt-6 rounded-[28px] p-6 sm:p-9">
              <div className="space-y-10">
                {config.sections.map((section) => (
                  <section key={section.title}>
                    <h2 className="text-2xl font-black tracking-[-.03em] text-slate-950">{section.title}</h2>
                    {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-slate-600">{paragraph}</p>)}
                    {section.bullets ? (
                      <ul className="mt-5 space-y-3">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-3 text-sm leading-6 text-slate-600">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>

              <div className="mt-10 border-t border-blue-100 pt-7">
                <p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Related SellerHisab resources</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {config.related.map((item) => (
                    <Link key={item.href} href={item.href} className="liquid-pill rounded-full px-4 py-2 text-xs font-extrabold text-slate-700 transition hover:text-blue-700">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-950">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                Missing records stay visible, so you can check the gaps before making a decision.
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="liquid-button rounded-xl font-extrabold">
                  <Link href={primaryCta.href}>{primaryCta.label} <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
                {secondaryCta ? <Button asChild variant="outline" className="rounded-xl bg-white/70 font-extrabold"><Link href={secondaryCta.href}>{secondaryCta.label}</Link></Button> : null}
              </div>
            </article>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
