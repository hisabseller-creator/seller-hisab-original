import type { SVGProps } from "react";
import { Globe2 } from "lucide-react";
import type { SocialPlatform } from "@/core/site-settings";

export function SocialBrandIcon({ platform, className = "size-4" }: { platform: SocialPlatform | "whatsapp"; className?: string }) {
  const brandedClass = `${className} social-brand social-brand-${platform}`;
  if (platform === "website" || platform === "other") return <Globe2 className={brandedClass} aria-hidden="true" />;
  const common: SVGProps<SVGSVGElement> = { className: brandedClass, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };
  switch (platform) {
    case "instagram": return <svg {...common}><path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.9 1.5a1.35 1.35 0 1 1 0 2.7 1.35 1.35 0 0 1 0-2.7ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>;
    case "telegram": return <svg {...common}><path d="M21.7 3.2 18.5 20c-.2 1.2-.9 1.5-1.8.9l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9-8.1c.4-.4-.1-.6-.6-.2L6 13.8 1.2 12.3c-1-.3-1-1 .2-1.5L20 3.6c.9-.3 1.7.2 1.7-.4Z"/></svg>;
    case "youtube": return <svg {...common}><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 15.7 4.5 12 4.5s-7 .1-8.9.6A3 3 0 0 0 1 7.2C.5 9 .5 12 .5 12s0 3 .5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 5.2.6 8.9.6s7-.1 8.9-.6a3 3 0 0 0 2.1-2.1c.5-1.8.5-4.8.5-4.8s0-3-.5-4.8ZM9.7 15.8V8.2l6.5 3.8-6.5 3.8Z"/></svg>;
    case "facebook": return <svg {...common}><path d="M13.6 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.7 1.8-1.7h1.9V2.5c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.8v2.3H6.7V13h3.1v9h3.8Z"/></svg>;
    case "linkedin": return <svg {...common}><path d="M5.3 7.9H1.7V22h3.6V7.9ZM3.5 2A2.1 2.1 0 1 0 3.5 6.2 2.1 2.1 0 0 0 3.5 2ZM22 13.9c0-4.2-2.2-6.2-5.2-6.2-2.4 0-3.5 1.3-4.1 2.2V7.9H9.1V22h3.6v-7c0-1.8.4-3.6 2.7-3.6 2.3 0 2.3 2.1 2.3 3.7V22H22v-8.1Z"/></svg>;
    case "x": return <svg {...common}><path d="M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-6.3L6.6 22H3.5l7.1-8.2L3 2h6.2l4.3 5.7L18.9 2Zm-1.1 17.9h1.7L8.3 4H6.5l11.3 15.9Z"/></svg>;
    case "whatsapp": return <svg {...common}><path d="M12.1 2a9.8 9.8 0 0 0-8.5 14.7L2 22l5.5-1.5A9.9 9.9 0 1 0 12.1 2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-3.3.9.9-3.2-.2-.3A8 8 0 1 1 12.1 19.8Zm4.4-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1-1.4-.7-2.4-1.3-3.3-2.9-.2-.3.2-.3.6-1 .1-.2.1-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.2 3.4 5.4 4.7 2 .9 2.8.9 3.8.8.6-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1-.1-.1-.3-.2-.5-.3Z"/></svg>;
    default: return <Globe2 className={brandedClass} aria-hidden="true" />;
  }
}
