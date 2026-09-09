"use client";

import Link from "next/link";
import { Home, LogIn } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brand } from "./brand";
import { useAccountStatus, useLanguage } from "./providers";

export function SiteHeader() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const { user, loading } = useAccountStatus();
  const english = language === "english";
  const showHome = Boolean(user && pathname !== "/");
  const loginHref = `/app?returnTo=${encodeURIComponent(pathname || "/")}`;

  return (
    <header className={`${pathname === "/" ? "relative" : "sticky top-0"} z-40 px-2.5 pt-2.5 sm:px-5 sm:pt-3`}>
      <div className="glass-nav mx-auto flex min-h-16 max-w-[1380px] items-center gap-2 rounded-[22px] px-2.5 sm:gap-4 sm:px-4 lg:px-5">
        <div className="min-w-0 flex-1"><Brand /></div>

        <div className="liquid-pill grid shrink-0 grid-cols-2 rounded-xl p-1" role="group" aria-label="Website language">
          <button type="button" onClick={() => setLanguage("english")} aria-pressed={english} className={`min-h-9 rounded-lg px-2 text-[10px] font-extrabold transition sm:px-3 sm:text-xs ${english ? "bg-blue-100/95 text-blue-800 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
            English
          </button>
          <button type="button" onClick={() => setLanguage("hinglish")} aria-pressed={!english} className={`min-h-9 rounded-lg px-2 text-[10px] font-extrabold transition sm:px-3 sm:text-xs ${!english ? "bg-blue-100/95 text-blue-800 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
            HinEnglish
          </button>
        </div>

        {loading ? <span className="hidden h-10 w-24 animate-pulse rounded-xl bg-blue-100/60 sm:block" aria-hidden="true" /> : !user ? (
          <Button asChild className="liquid-button h-10 shrink-0 rounded-xl px-2.5 text-[11px] font-extrabold sm:px-4 sm:text-xs">
            <Link href={loginHref}><LogIn className="size-4 sm:mr-1.5" /><span className="hidden sm:inline">Login / Register</span><span className="sm:hidden">Login</span></Link>
          </Button>
        ) : showHome ? (
          <Button asChild className="liquid-button h-10 shrink-0 rounded-xl px-3 text-xs font-extrabold sm:px-4">
            <Link href="/"><Home className="mr-1.5 size-4" />Home</Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

