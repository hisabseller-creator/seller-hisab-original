import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PublicShell>
      <main className="grid min-h-[55vh] place-items-center px-4 py-16">
        <section className="liquid-panel max-w-2xl rounded-[28px] p-8 text-center sm:p-12">
          <p className="eyebrow">404</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-.045em] text-slate-950">This SellerHisab page does not exist.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">Use a public calculator, seller-finance guide or the free report analysis instead.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 text-sm font-bold">
            <Link href="/" className="liquid-pill rounded-full px-4 py-2 text-blue-700">Home</Link>
            <Link href="/calculators" className="liquid-pill rounded-full px-4 py-2 text-blue-700">Calculators</Link>
            <Link href="/guides" className="liquid-pill rounded-full px-4 py-2 text-blue-700">Guides</Link>
            <Link href="/analyze" className="liquid-button rounded-full px-4 py-2">Analyze report</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
