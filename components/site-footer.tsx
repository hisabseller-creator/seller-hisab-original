"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Mail, Phone } from "lucide-react";
import { Brand } from "./brand";
import { SocialBrandIcon } from "./social-brand-icon";
import { useAccountStatus, useLanguage, useSiteSettings } from "./providers";
import { socialHref, socialLabel, type SiteSettings, type SocialPlatform } from "@/core/site-settings";

export function SiteFooter() {
  const { language, setLanguage } = useLanguage();
  const { user } = useAccountStatus();
  const { settings } = useSiteSettings();
  const english = language === "english";

  const productLinks: Array<readonly [string, string]> = [
    ["Profit Check", "/analyze"],
    ["Blog", "/blog"],
  ];
  if (settings.navigation.showPricing) productLinks.push(["Pricing", "/pricing"]);
  if (settings.navigation.showCalculators) productLinks.push(["Calculators", "/calculators"]);
  if (settings.navigation.showHowToUse) productLinks.push([english ? "How to Use" : "कैसे use करें", "/help"]);
  productLinks.push([user ? (english ? "My Account" : "मेरा Account") : "Login / Register", "/app"]);

  const groups: Array<{ title: string; links: Array<readonly [string, string]> }> = [
    { title: "Product", links: productLinks },
    {
      title: "Learn",
      links: [
        ["Marketplaces", "/marketplaces"],
        ["Guides", "/guides"],
        ["About", "/about"],
        ["What’s New", "/news"],
        ["Help Center", "/help"],
        ["Contact", "/contact"],
      ],
    },
    {
      title: "Trust",
      links: [
        ["Methodology", "/methodology"],
        ["Editorial", "/editorial-policy"],
        ["Corrections", "/corrections-policy"],
        ["Privacy", "/privacy"],
        ["Terms", "/terms"],
        ["Refund policy", "/refund-policy"],
      ],
    },
  ];

  const socialLinks = footerContacts(settings.contact);

  function requestUpdates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("updatesEmail") ?? "").trim();
    if (!email) return;

    if (settings.contact.supportEmail) {
      const subject = encodeURIComponent("SellerHisab updates request");
      const body = encodeURIComponent(`Please add ${email} to SellerHisab product and marketplace updates.`);
      window.location.href = `mailto:${settings.contact.supportEmail}?subject=${subject}&body=${body}`;
      return;
    }

    window.location.href = `/contact?topic=updates&email=${encodeURIComponent(email)}`;
  }

  return (
    <footer className="website-footer footer-reference">
      <div className="footer-reference-shell mx-auto max-w-[1480px]">
        <div className="footer-reference-glow" aria-hidden="true" />

        <div className="footer-reference-main">
          <section className="footer-reference-brand footer-brand-card" aria-label="SellerHisab">
            <div className="footer-reference-brandmark"><Brand /></div>
            <p className="footer-reference-tagline">
              {english ? "See real margin, not just sales." : "सिर्फ sales नहीं, real margin देखो।"}
            </p>
            <p className="footer-reference-disclaimer">
              {english ? settings.footer.affiliationDisclaimer : settings.footer.descriptionHinglish}
            </p>

            <div className="footer-reference-socials" aria-label="SellerHisab contact and social links">
              {socialLinks.map((item) => (
                <a
                  key={`${item.kind}-${item.href}`}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="footer-reference-social"
                  aria-label={item.label}
                  title={item.label}
                >
                  {item.kind === "mail" ? (
                    <Mail className="size-5" />
                  ) : item.kind === "phone" ? (
                    <Phone className="size-5" />
                  ) : (
                    <SocialBrandIcon platform={item.platform!} className="size-5" />
                  )}
                </a>
              ))}
              {!socialLinks.some((item) => item.kind === "mail") ? (
                <Link className="footer-reference-social" href="/contact" aria-label="Contact SellerHisab" title="Contact SellerHisab">
                  <Mail className="size-5" />
                </Link>
              ) : null}
            </div>
          </section>

          <nav className="footer-reference-links" aria-label="Footer navigation">
            {groups.map((group) => (
              <div className="footer-reference-link-group" key={group.title}>
                <h2>{group.title}</h2>
                <span className="footer-reference-heading-line" aria-hidden="true" />
                <ul>
                  {group.links.map(([label, href]) => (
                    <li key={`${group.title}-${href}`}>
                      <Link className="footer-ref-link" href={href}>{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <section className="footer-reference-updates" aria-label="SellerHisab updates">
            <div className="footer-reference-updates-title">
              <span className="footer-reference-mail-icon"><Mail className="size-5" /></span>
              <div>
                <h2>Stay Updated</h2>
                <p>Get new tools, tips and marketplace updates.</p>
              </div>
            </div>

            <form className="footer-reference-update-form" onSubmit={requestUpdates}>
              <label className="sr-only" htmlFor="footer-updates-email">Email for SellerHisab updates</label>
              <input
                id="footer-updates-email"
                name="updatesEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email"
                required
              />
              <button type="submit" aria-label="Request SellerHisab updates">
                <ArrowRight className="size-6" />
              </button>
            </form>
            <p className="footer-reference-update-note">Useful updates only. You can opt out anytime.</p>
          </section>
        </div>

        <div className="footer-reference-bottom">
          <p>
            <strong>© 2026 SellerHisab.</strong>
            <span> Analytical estimates only; not tax, legal or accounting advice.</span>
          </p>

          <div className="footer-reference-bottom-actions">
            <div className="footer-reference-language" role="group" aria-label="Footer language">
              <button type="button" onClick={() => setLanguage("english")} aria-pressed={english}>EN</button>
              <span aria-hidden="true">|</span>
              <button type="button" onClick={() => setLanguage("hinglish")} aria-pressed={!english}>हिन्दी</button>
            </div>
            <span className="footer-reference-divider" aria-hidden="true" />
            <div className="footer-reference-built">
              <Heart className="size-5 fill-current" />
              <span>Built for<br />Sellers</span>
              <span className="footer-reference-built-line" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

type FooterContact =
  | { kind: "mail"; href: string; label: string; external?: false }
  | { kind: "phone"; href: string; label: string; external?: false }
  | { kind: "social"; href: string; label: string; platform: SocialPlatform | "whatsapp"; external: true };

function footerContacts(contact: SiteSettings["contact"]): FooterContact[] {
  const links: FooterContact[] = [];

  if (contact.supportEmail) {
    links.push({ kind: "mail", href: `mailto:${contact.supportEmail}`, label: contact.supportEmail });
  }
  if (contact.phoneNumber) {
    links.push({ kind: "phone", href: `tel:${digits(contact.phoneNumber)}`, label: contact.phoneNumber });
  }
  if (contact.whatsappNumber) {
    links.push({
      kind: "social",
      href: `https://wa.me/${digits(contact.whatsappNumber)}`,
      label: "WhatsApp",
      platform: "whatsapp",
      external: true,
    });
  }

  const socials = [...contact.socialLinks];
  if (contact.instagramHandle && !socials.some((item) => item.platform === "instagram")) {
    socials.unshift({ platform: "instagram", label: "", value: contact.instagramHandle });
  }

  for (const item of socials) {
    const href = socialHref(item.platform, item.value);
    if (!href) continue;
    links.push({
      kind: "social",
      href,
      label: socialLabel(item.platform, item.value, item.label),
      platform: item.platform,
      external: true,
    });
  }

  return links;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}
