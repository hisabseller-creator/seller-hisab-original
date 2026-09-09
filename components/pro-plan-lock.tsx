"use client";

import Link from "next/link";
import { FileSpreadsheet, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProPlanLockProps = {
  title: string;
  description: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ProPlanLock({ title, description, secondaryHref, secondaryLabel }: ProPlanLockProps) {
  return (
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
          <LockKeyhole className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-blue-700">Pro plan</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="bg-blue-600 font-bold hover:bg-blue-700">
              <Link href="/app/billing">View Pro plan</Link>
            </Button>
            {secondaryHref && secondaryLabel && (
              <Button asChild variant="outline">
                <Link href={secondaryHref}><FileSpreadsheet className="mr-2 size-4" />{secondaryLabel}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
