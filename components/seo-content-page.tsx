import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SeoContentConfig } from "@/core/seo-hubs";
import { PublicShell } from "./public-shell";

export function SeoContentPage({
  config,
  parent,
}: {
  config: SeoContentConfig;
  parent: { href: string; label: string };
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

            <p className="eyebrow mt-8">{config.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-balance text-4xl font-black leading-tight tracking-[-.045em] text-slate-950 sm:text-5xl">{config.headline}</h1>

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

              <div className="mt-8">
                <Button asChild className="liquid-button rounded-xl font-extrabold">
                  <Link href="/analyze">Analyze your own report <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
              </div>
            </article>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
