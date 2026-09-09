"use client";
import { useState, useEffect, useSyncExternalStore } from "react";
export function BlogLocalizedContent({
  initialLanguage,
  fixedLanguage = false,
  hindiHtml,
  englishHtml,
}: {
  initialLanguage?: "hi" | "en";
  fixedLanguage?: boolean;
  hindiHtml: string;
  englishHtml: string;
}) {
  const ready=useSyncExternalStore(subscribeReady,()=>true,()=>false);
  const hasHindi = Boolean(hindiHtml.trim());
  const hasEnglish = Boolean(englishHtml.trim());
  const bilingual = hasHindi && hasEnglish;
  const [language, setLanguage] = useState<"hi" | "en">(
    initialLanguage ?? (hasHindi ? "hi" : "en"),
  );
  const activeLanguage = bilingual
    ? language
    : hasHindi
      ? "hi"
      : "en";
  useEffect(()=>{const previous=document.documentElement.lang;document.documentElement.lang=activeLanguage;return ()=>{document.documentElement.lang=previous;};},[activeLanguage]);
  return (
    <>
      {bilingual && !fixedLanguage ? (
        <div className="mx-auto mb-4 flex max-w-[980px] justify-end">
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
            role="group"
            aria-label="Article language"
          >
            <button
              type="button"
              disabled={!ready}
              onClick={() => setLanguage("hi")}
              aria-pressed={activeLanguage === "hi"}
              className={
                activeLanguage === "hi"
                  ? "min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm"
                  : "min-h-11 rounded-lg px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              }
            >
              हिंदी
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => setLanguage("en")}
              aria-pressed={activeLanguage === "en"}
              className={
                activeLanguage === "en"
                  ? "min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm"
                  : "min-h-11 rounded-lg px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              }
            >
              English
            </button>
          </div>
        </div>
      ) : null}
      {hasHindi && (!fixedLanguage || activeLanguage === "hi") ? (
        <article
          lang="hi"
          hidden={activeLanguage !== "hi"}
          className="blog-article-shell blog-html mx-auto max-w-[980px] rounded-[30px] p-5 sm:p-8 md:p-10"
          dangerouslySetInnerHTML={{ __html: scrollableTables(hindiHtml) }}
        />
      ) : null}
      {hasEnglish && (!fixedLanguage || activeLanguage === "en") ? (
        <article
          lang="en"
          hidden={activeLanguage !== "en"}
          className="blog-article-shell blog-html mx-auto max-w-[980px] rounded-[30px] p-5 sm:p-8 md:p-10"
          dangerouslySetInnerHTML={{ __html: scrollableTables(englishHtml) }}
        />
      ) : null}
    </>
  );
}

function scrollableTables(html:string){return html.replace(/<table(\s|>)/gi,'<div class="blog-table-scroll" tabindex="0" role="region" aria-label="Article data table, scroll horizontally for more columns"><table$1').replace(/<\/table>/gi,'</table></div>');}

function subscribeReady(){return ()=>{};}
