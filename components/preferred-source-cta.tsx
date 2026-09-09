import { ExternalLink } from "lucide-react";

export function PreferredSourceCta({ label }: { label: string }) {
  const href = "https://www.google.com/preferences/source?q=sellerhisab.com";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100"
    >
      {label}<ExternalLink className="ml-2 size-3.5" />
    </a>
  );
}
