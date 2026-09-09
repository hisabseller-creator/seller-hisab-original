import Link from "next/link";
import { ArrowUpRight, Info, ShieldCheck } from "lucide-react";
import { PublicShell } from "./public-shell";

export type InfoSection = { title: string; paragraphs?: string[]; bullets?: string[] };

export function InfoPage({ eyebrow, title, intro, sections, note }: { eyebrow: string; title: string; intro: string; sections: InfoSection[]; note?: string }) {
  return (
    <PublicShell>
      <main className="website-info website-container">
        <header className="info-intro"><p className="website-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></header>
        <div className="info-layout">
          <nav className="info-contents" aria-label="On this page">
            <p>On this page</p>
            {sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}
          </nav>
          <article className="info-article">
            {sections.map((section, index) => (
              <section key={section.title} id={`section-${index + 1}`}>
                <h2>{section.title}</h2>
                {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}
              </section>
            ))}
            {note && <aside className="info-note"><Info size={19} aria-hidden="true"/><p>{note}</p></aside>}
            <div className="info-next"><Link className="website-button" href="/analyze">Check my profit <ArrowUpRight size={17}/></Link><Link className="website-text-link" href="/methodology">Our methodology <ArrowUpRight size={15}/></Link></div>
          </article>
        </div>
      </main>
    </PublicShell>
  );
}

export function TrustNote({ children }: { children: React.ReactNode }) { return <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />{children}</div>; }
