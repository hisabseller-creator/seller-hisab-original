"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BookOpenText, CheckCircle2, CircleUserRound, ContactRound, CreditCard, Eye, Home, KeyRound, LifeBuoy, Loader2, MenuSquare, Newspaper, Plus, Save, Settings2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SITE_SETTINGS, socialPlatforms, type SiteSettings, type SocialPlatform } from "@/core/site-settings";
import { Brand } from "./brand";
import { useAccountStatus, useSiteSettings } from "./providers";
import { AdminBlogManager } from "./admin-blog-manager";
import { AdminSeoManager } from "./admin-seo-manager";
import { AdminUserManager } from "./admin-user-manager";
import { AdminSupportManager } from "./admin-support-manager";
import { AdminOperationsManager } from "./admin-operations-manager";
import { AdminBillingTrialManager } from "./admin-billing-trial-manager";

type AdminView = "content" | "blog" | "seo" | "users" | "billing" | "support" | "operations" | "navigation" | "contact" | "security" | "preview";

const adminViews = [
  { id: "users", label: "Users & purchases", icon: CircleUserRound },
  { id: "billing", label: "Billing & trials", icon: CreditCard },
  { id: "support", label: "Support queue", icon: LifeBuoy },
  { id: "operations", label: "Operations", icon: Activity },
  { id: "content", label: "Page content", icon: BookOpenText },
  { id: "blog", label: "Blog posts", icon: Newspaper },
  { id: "seo", label: "SEO & Distribution", icon: Settings2 },
  { id: "navigation", label: "Navigation", icon: MenuSquare },
  { id: "contact", label: "Contact & footer", icon: ContactRound },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "preview", label: "Review", icon: Eye },
] as const;

export function AdminPanel() {
  const { user, loading: accountLoading } = useAccountStatus();
  const { setSettings: setPublicSettings } = useSiteSettings();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [view, setView] = useState<AdminView>("users");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    fetch("/api/admin/site-settings", { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() as { settings?: SiteSettings; error?: string } }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Settings could not be loaded.");
        setSettings(payload.settings);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Settings could not be loaded."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  if (accountLoading) return <div className="app-wallpaper grid min-h-screen place-items-center"><Loader2 className="size-7 animate-spin text-blue-600" /></div>;
  if (!user) return <AdminGate title="Admin sign-in required" text="Login with an account configured in ADMIN_EMAILS or ADMIN_PHONES, then you will return to the website manager." />;
  if (!user.isAdmin) return <AdminGate title="Admin access is not enabled" text={`The signed-in account ${user.email ?? user.phone ?? ""} is not listed in ADMIN_EMAILS or ADMIN_PHONES.`} denied />;
  if (loading) return <div className="app-wallpaper grid min-h-screen place-items-center"><Loader2 className="size-7 animate-spin text-blue-600" /></div>;

  async function publish() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json() as { settings?: SiteSettings; updatedAt?: string; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Changes could not be published.");
      setSettings(payload.settings);
      setPublicSettings(payload.settings);
      setUpdatedAt(payload.updatedAt ?? new Date().toISOString());
      toast.success("Website changes published.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Changes could not be published.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-wallpaper min-h-screen pb-24 md:grid md:grid-cols-[250px_1fr] md:pb-0">
      <aside className="glass-nav m-3 hidden min-h-[calc(100vh-1.5rem)] rounded-[26px] p-5 md:block">
        <Brand />
        <p className="mt-7 text-[10px] font-black uppercase tracking-[.15em] text-blue-600">Website Admin</p>
        <nav className="mt-3 space-y-1" aria-label="Admin sections">{adminViews.map((item) => <AdminNavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}</nav>
        <Button asChild variant="outline" className="mt-8 w-full justify-start rounded-xl bg-white/70"><Link href="/"><Home className="mr-2 size-4" />View website</Link></Button>
      </aside>

      <div>
        <header className="glass-nav mx-3 mt-3 flex min-h-16 items-center justify-between rounded-[22px] px-4 sm:px-5">
          <div><p className="text-xs font-black uppercase tracking-[.13em] text-blue-600">Website Admin</p><p className="mt-1 hidden text-xs text-slate-500 sm:block">Signed in as {user.email ?? user.phone}</p></div>
          <div className="flex gap-2"><Button asChild variant="outline" size="sm" className="rounded-xl bg-white/70"><Link href={view === "blog" ? "/blog" : view === "seo" ? "/sitemap.xml" : "/"}><Eye className="mr-1.5 size-4" />{view === "blog" ? "View blog" : view === "seo" ? "View sitemap" : "Preview"}</Link></Button>{view !== "blog" && view !== "seo" && view !== "users" && view !== "billing" && view !== "support" && view !== "operations" && view !== "security" && <Button size="sm" className="liquid-button rounded-xl font-extrabold" onClick={publish} disabled={saving}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}Publish</Button>}</div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
          <div className="mb-6 grid grid-cols-2 gap-2 md:hidden">{adminViews.map((item) => <AdminNavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}</div>
          {view === "content" && <ContentEditor settings={settings} onChange={setSettings} />}
          {view === "blog" && <AdminBlogManager />}
          {view === "seo" && <AdminSeoManager />}
          {view === "users" && <AdminUserManager />}
          {view === "billing" && <AdminBillingTrialManager />}
          {view === "support" && <AdminSupportManager />}
          {view === "operations" && <AdminOperationsManager />}
          {view === "navigation" && <NavigationEditor settings={settings} onChange={setSettings} />}
          {view === "contact" && <ContactEditor settings={settings} onChange={setSettings} />}
          {view === "security" && <AdminSecurity identifier={user.email ?? user.phone ?? "Admin"} />}
          {view === "preview" && <ReviewSettings settings={settings} updatedAt={updatedAt} />}
        </main>
      </div>

      {view !== "blog" && view !== "seo" && view !== "users" && view !== "billing" && view !== "support" && view !== "operations" && view !== "security" && <div className="glass-nav fixed inset-x-2 bottom-2 z-40 flex items-center justify-between gap-3 rounded-2xl p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] md:hidden"><div><p className="text-xs font-extrabold text-slate-900">Ready to update?</p><p className="text-[10px] text-slate-500">Changes go live after Publish.</p></div><Button className="liquid-button rounded-xl font-extrabold" onClick={publish} disabled={saving}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}Publish</Button></div>}
    </div>
  );
}


function AdminSecurity({ identifier }: { identifier: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const strongEnough =
    newPassword.length >= 12 &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    /[^A-Za-z0-9]/.test(newPassword);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (!strongEnough) {
      toast.error("Use at least 12 characters with uppercase, lowercase, a number and a symbol.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Password could not be changed.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Admin password changed. Other signed-in sessions were closed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password could not be changed.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <EditorSection
      icon={KeyRound}
      eyebrow="Admin security"
      title="Change admin password"
      description="Changing the password signs out every other SellerHisab admin session. This browser receives a fresh session automatically."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <form onSubmit={changePassword} className="data-entry-card rounded-2xl p-5 sm:p-6">
          <div>
            <Label htmlFor="admin-current-password" className="text-xs font-extrabold text-slate-800">Current password</Label>
            <Input
              id="admin-current-password"
              type="password"
              autoComplete="current-password"
              className="data-entry mt-2 h-12"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="admin-new-password" className="text-xs font-extrabold text-slate-800">New password</Label>
            <Input
              id="admin-new-password"
              type="password"
              autoComplete="new-password"
              className="data-entry mt-2 h-12"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="admin-confirm-password" className="text-xs font-extrabold text-slate-800">Confirm new password</Label>
            <Input
              id="admin-confirm-password"
              type="password"
              autoComplete="new-password"
              className="data-entry mt-2 h-12"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs leading-5 text-slate-600">
            Minimum 12 characters with uppercase, lowercase, number and symbol.
          </div>

          <Button
            type="submit"
            className="liquid-button mt-5 w-full rounded-xl font-extrabold"
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {savingPassword ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
            Change password
          </Button>
        </form>

        <div className="space-y-3">
          <div className="data-entry-card rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-[.12em] text-blue-600">Admin login ID</p>
            <p className="mt-2 break-all text-sm font-black text-slate-950">{identifier}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm leading-6 text-emerald-950">
            <CheckCircle2 className="mr-2 inline size-5" />
            Passwords are stored only as PBKDF2-SHA256 hashes. The raw password is never stored in D1.
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm leading-6 text-amber-950">
            Keep the permanent admin password in a password manager. Do not reuse it on email, Cloudflare or Razorpay.
          </div>
        </div>
      </div>
    </EditorSection>
  );
}

function ContentEditor({ settings, onChange }: EditorProps) {
  return <EditorSection icon={BookOpenText} eyebrow="Home screen" title="Main page content" description="English stays the default. Hindi words in Hinglish use Devanagari."><div className="grid gap-5 lg:grid-cols-2"><TextBlock label="English headline" value={settings.hero.headlineEnglish} onChange={(value) => onChange({ ...settings, hero: { ...settings.hero, headlineEnglish: value } })} /><TextBlock label="Hinglish headline" value={settings.hero.headlineHinglish} onChange={(value) => onChange({ ...settings, hero: { ...settings.hero, headlineHinglish: value } })} /><TextBlock area label="English description" value={settings.hero.descriptionEnglish} onChange={(value) => onChange({ ...settings, hero: { ...settings.hero, descriptionEnglish: value } })} /><TextBlock area label="Hinglish description" value={settings.hero.descriptionHinglish} onChange={(value) => onChange({ ...settings, hero: { ...settings.hero, descriptionHinglish: value } })} /></div></EditorSection>;
}

function NavigationEditor({ settings, onChange }: EditorProps) {
  const toggles = [
    ["showCalculators", "Calculators", "Profit, RTO, break-even, ACoS and ROAS tools."],
    ["showPricing", "Pricing", "Plan and one-time report pricing."],
    ["showHowToUse", "How to Use", "Report download and analysis help."],
  ] as const;
  return <EditorSection icon={MenuSquare} eyebrow="Navigation" title="Feature tab visibility" description="Profit Check and account access are permanent safety routes."><div className="grid gap-3 sm:grid-cols-2">{toggles.map(([key, label, help]) => <label key={key} className="data-entry-card flex items-start justify-between gap-4 rounded-2xl p-4"><span><span className="block text-sm font-black text-slate-900">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span></span><Switch checked={settings.navigation[key]} onCheckedChange={(checked) => onChange({ ...settings, navigation: { ...settings.navigation, [key]: checked } })} /></label>)}</div></EditorSection>;
}

function ContactEditor({ settings, onChange }: EditorProps) {
  const updateContact = (key: "supportEmail" | "phoneNumber" | "whatsappNumber" | "instagramHandle", value: string) => onChange({ ...settings, contact: { ...settings.contact, [key]: value } });
  const socials = settings.contact.socialLinks;
  const addSocial = () => onChange({ ...settings, contact: { ...settings.contact, socialLinks: [...socials, { platform: "instagram", label: "", value: "" }] } });
  const updateSocial = (index: number, patch: Partial<{ platform: SocialPlatform; label: string; value: string }>) => onChange({ ...settings, contact: { ...settings.contact, socialLinks: socials.map((item, i) => i === index ? { ...item, ...patch } : item) } });
  const removeSocial = (index: number) => onChange({ ...settings, contact: { ...settings.contact, socialLinks: socials.filter((_, i) => i !== index) } });
  return <div className="space-y-5">
    <EditorSection icon={ContactRound} eyebrow="Public contacts" title="Contact details" description="Leave a field blank to hide it. Phone, WhatsApp and social profiles publish only after you press Publish.">
      <div className="grid gap-5 sm:grid-cols-2"><TextBlock label="Support email" value={settings.contact.supportEmail} onChange={(value) => updateContact("supportEmail", value)} placeholder="support@yourdomain.com" /><TextBlock label="Phone number" value={settings.contact.phoneNumber} onChange={(value) => updateContact("phoneNumber", value)} placeholder="+91 98765 43210" /><TextBlock label="WhatsApp number" value={settings.contact.whatsappNumber} onChange={(value) => updateContact("whatsappNumber", value)} placeholder="+91 98765 43210" /><TextBlock label="Legacy Instagram handle" value={settings.contact.instagramHandle} onChange={(value) => updateContact("instagramHandle", value)} placeholder="@sellerhisab" /></div>
      <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-950">Social profiles</p><p className="mt-1 text-xs leading-5 text-slate-600">Add Instagram, Telegram, YouTube, Facebook, LinkedIn, X or any website. The public footer automatically uses the matching brand icon.</p></div><Button type="button" variant="outline" className="rounded-xl bg-white" onClick={addSocial}><Plus className="mr-1.5 size-4" />Add social link</Button></div>
        <div className="mt-4 space-y-3">{socials.length ? socials.map((item, index) => <div key={`${index}-${item.platform}`} className="grid gap-3 rounded-xl border border-blue-100 bg-white p-3 sm:grid-cols-[150px_1fr_1fr_auto] sm:items-end"><div><Label className="text-xs font-extrabold text-slate-800">Platform</Label><select className="data-entry mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800" value={item.platform} onChange={(event) => updateSocial(index, { platform: event.target.value as SocialPlatform })}>{socialPlatforms.map((platform) => <option key={platform} value={platform}>{socialPlatformLabel(platform)}</option>)}</select></div><TextBlock label="Handle or URL" value={item.value} onChange={(value) => updateSocial(index, { value })} placeholder={socialPlaceholder(item.platform)} /><TextBlock label="Custom label (optional)" value={item.label} onChange={(value) => updateSocial(index, { label: value })} placeholder="SellerHisab" /><Button type="button" variant="outline" className="h-12 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeSocial(index)} aria-label={`Remove ${socialPlatformLabel(item.platform)}`}><Trash2 className="size-4" /></Button></div>) : <p className="rounded-xl border border-dashed border-blue-200 bg-white/70 px-4 py-5 text-center text-xs leading-5 text-slate-500">No social profiles added yet.</p>}</div>
      </div>
    </EditorSection>
    <EditorSection icon={Settings2} eyebrow="Footer copy" title="Footer description and disclaimer"><div className="grid gap-5 lg:grid-cols-2"><TextBlock area label="English description" value={settings.footer.descriptionEnglish} onChange={(value) => onChange({ ...settings, footer: { ...settings.footer, descriptionEnglish: value } })} /><TextBlock area label="Hinglish description" value={settings.footer.descriptionHinglish} onChange={(value) => onChange({ ...settings, footer: { ...settings.footer, descriptionHinglish: value } })} /><div className="lg:col-span-2"><TextBlock area label="Independent affiliation disclaimer" value={settings.footer.affiliationDisclaimer} onChange={(value) => onChange({ ...settings, footer: { ...settings.footer, affiliationDisclaimer: value } })} /></div></div></EditorSection>
  </div>;
}

function socialPlatformLabel(platform: SocialPlatform) {
  return ({ instagram: "Instagram", telegram: "Telegram", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn", x: "X", website: "Website", other: "Other link" } as const)[platform];
}

function socialPlaceholder(platform: SocialPlatform) {
  if (platform === "instagram" || platform === "telegram" || platform === "x") return "@sellerhisab";
  if (platform === "youtube") return "@sellerhisab or full YouTube URL";
  return "https://...";
}

function ReviewSettings({ settings, updatedAt }: { settings: SiteSettings; updatedAt: string }) {
  const visibleContacts = [settings.contact.supportEmail, settings.contact.phoneNumber, settings.contact.whatsappNumber, settings.contact.instagramHandle].filter(Boolean).length + settings.contact.socialLinks.filter((item) => item.value.trim()).length;
  const visibleTabs = Object.values(settings.navigation).filter(Boolean).length + 2;
  return <EditorSection icon={Eye} eyebrow="Final review" title="Ready to publish" description="Review the public impact before saving."><div className="grid gap-4 sm:grid-cols-3"><ReviewCard label="Visible feature tabs" value={String(visibleTabs)} /><ReviewCard label="Contact methods" value={String(visibleContacts)} /><ReviewCard label="Last publish" value={updatedAt ? new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Not in this session"} /></div><div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-900"><CheckCircle2 className="mr-2 inline size-5" />Only public copy, navigation flags and contact details are stored. Seller reports and financial rows never enter the admin system.</div></EditorSection>;
}

function EditorSection({ icon: Icon, eyebrow, title, description, children }: { icon: typeof Settings2; eyebrow: string; title: string; description?: string; children: React.ReactNode }) {
  return <section className="liquid-panel rounded-[26px] p-5 sm:p-7"><div className="flex items-start gap-4"><span className="liquid-button grid size-11 shrink-0 place-items-center rounded-2xl"><Icon className="size-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">{eyebrow}</p><h1 className="mt-1 text-xl font-black tracking-[-.03em] text-slate-950 sm:text-2xl">{title}</h1>{description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}</div></div><div className="mt-7">{children}</div></section>;
}

function TextBlock({ label, value, onChange, placeholder, area = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; area?: boolean }) {
  return <div><Label className="text-xs font-extrabold text-slate-800">{label}</Label>{area ? <Textarea className="data-entry mt-2 min-h-28" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <Input className="data-entry mt-2 h-12" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</div>;
}

function ReviewCard({ label, value }: { label: string; value: string }) { return <div className="data-entry-card rounded-2xl p-4"><p className="text-2xl font-black tabular-nums text-slate-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>; }

function AdminNavButton({ item, active, onClick }: { item: typeof adminViews[number]; active: boolean; onClick: () => void }) { const Icon = item.icon; return <button type="button" onClick={onClick} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-extrabold transition sm:text-sm ${active ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}><Icon className="size-4.5" />{item.label}</button>; }

function AdminGate({ title, text, denied = false }: { title: string; text: string; denied?: boolean }) {
  return <div className="app-wallpaper grid min-h-screen place-items-center px-4 py-12"><div className="liquid-panel w-full max-w-md rounded-[26px] p-6 text-center sm:p-8"><span className={`mx-auto grid size-12 place-items-center rounded-2xl ${denied ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}><ShieldAlert className="size-6" /></span><h1 className="mt-5 text-2xl font-black tracking-[-.035em] text-slate-950">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p><Button asChild className="liquid-button mt-6 w-full rounded-xl font-extrabold"><Link href={denied ? "/" : "/app?returnTo=/admin"}>{denied ? "Back to website" : "Login / Register"}</Link></Button></div></div>;
}

type EditorProps = { settings: SiteSettings; onChange: (settings: SiteSettings) => void };
