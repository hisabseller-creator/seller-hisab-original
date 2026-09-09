"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, ExternalLink, Globe2, Link2, Loader2, Newspaper, Plus, Save, Search, Send, ShieldCheck, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SEO_SETTINGS, type SeoSettings } from "@/core/seo-settings";

type SeoRedirect = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function AdminSeoManager() {
  const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [redirects, setRedirects] = useState<SeoRedirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualPaths, setManualPaths] = useState("/blog\n/news\n/videos");
  const [indexNowBusy, setIndexNowBusy] = useState(false);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [settingsResponse, redirectResponse] = await Promise.all([
        fetch("/api/admin/seo-settings", { cache: "no-store" }),
        fetch("/api/admin/seo-redirects", { cache: "no-store" }),
      ]);
      const settingsPayload = await settingsResponse.json() as { settings?: SeoSettings; error?: string };
      const redirectPayload = await redirectResponse.json() as { redirects?: SeoRedirect[]; error?: string };
      if (!settingsResponse.ok || !settingsPayload.settings) throw new Error(settingsPayload.error ?? "SEO settings could not be loaded.");
      if (!redirectResponse.ok || !redirectPayload.redirects) throw new Error(redirectPayload.error ?? "SEO redirects could not be loaded.");
      setSettings(settingsPayload.settings);
      setRedirects(redirectPayload.redirects);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SEO settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sitemapUrls = useMemo(() => [
    "/sitemap.xml",
    settings.discovery.newsSitemapEnabled ? "/news-sitemap.xml" : null,
    settings.discovery.imageSitemapEnabled ? "/image-sitemap.xml" : null,
    settings.discovery.videoSitemapEnabled ? "/video-sitemap.xml" : null,
    settings.discovery.rssEnabled ? "/feed.xml" : null,
    settings.discovery.llmsTxtEnabled ? "/llms.txt" : null,
  ].filter(Boolean) as string[], [settings.discovery]);

  async function saveSettings() {
    setSaving(true);
    try {
      let response = await fetch("/api/admin/seo-settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
      if(response.status===409){
        const preview=await response.json() as {confirmation?:string;impact?:string[]};
        if(!preview.confirmation || !window.confirm('Review changes:\n'+(preview.impact??[]).join('\n')+'\nPublish? The previous version is saved for rollback.'))return;
        response=await fetch('/api/admin/seo-settings',{method:'PUT',headers:{'content-type':'application/json','x-seo-confirmation':preview.confirmation},body:JSON.stringify(settings)});
      }
      const payload = await response.json() as { settings?: SeoSettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "SEO settings could not be saved.");
      setSettings(payload.settings);
      toast.success("SEO settings published.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SEO settings could not be saved.");
    } finally { setSaving(false); }
  }

  async function previewRollback(){
    try{const response=await fetch('/api/admin/seo-settings',{method:'POST'});const payload=await response.json() as {settings?:SeoSettings;error?:string};if(!response.ok||!payload.settings)throw Error(payload.error??'Rollback preview unavailable');setSettings(payload.settings);toast.info('Previous version loaded for review. Publish to apply it.');}catch(error){toast.error(error instanceof Error?error.message:'Rollback preview unavailable');}
  }

  async function submitIndexNow() {
    const paths = manualPaths.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    if (!paths.length) return;
    setIndexNowBusy(true);
    try {
      const response = await fetch("/api/admin/indexnow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths }) });
      const payload = await response.json() as { submitted?: number; ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "IndexNow submission failed.");
      toast.success(`${payload.submitted ?? paths.length} URL(s) sent to IndexNow.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "IndexNow submission failed."); }
    finally { setIndexNowBusy(false); }
  }

  async function addRedirect() {
    if (!fromPath.trim() || !toPath.trim()) return;
    try {
      const response = await fetch("/api/admin/seo-redirects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromPath, toPath, statusCode: 308, active: true }) });
      const payload = await response.json() as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error ?? "Redirect could not be saved.");
      setFromPath(""); setToPath(""); toast.success("SEO redirect saved."); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Redirect could not be saved."); }
  }

  async function removeRedirect(id: string) {
    const response = await fetch("/api/admin/seo-redirects", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (!response.ok) { const payload = await response.json() as { error?: string }; toast.error(payload.error ?? "Redirect could not be deleted."); return; }
    setRedirects((current) => current.filter((item) => item.id !== id));
  }

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;

  const updateCrawler = (key: keyof SeoSettings["crawlers"], value: boolean) => setSettings({ ...settings, crawlers: { ...settings.crawlers, [key]: value } });
  const updateDiscovery = (key: keyof SeoSettings["discovery"], value: boolean | string) => setSettings({ ...settings, discovery: { ...settings.discovery, [key]: value } });

  return (
    <div className="space-y-5">
      <section className="liquid-panel rounded-[26px] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">F13 SEO control center</p><h1 className="mt-1 text-2xl font-black tracking-[-.035em] text-slate-950">All-surface search & content distribution</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Manage Search, Discover, News, Images, Video, Bing/IndexNow, AI crawlers, feeds and future-ready publisher settings without editing code.</p></div>
          <Button onClick={saveSettings} disabled={saving} className="liquid-button rounded-xl font-black">{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Publish SEO settings</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" onClick={()=>void previewRollback()} disabled={saving}>Review previous version</Button><Button variant="outline" onClick={()=>{setSettings(structuredClone(DEFAULT_SEO_SETTINGS));toast.info('Defaults loaded for review. Publish to apply them.');}} disabled={saving}>Review defaults</Button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sitemapUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-black text-blue-700">{url}<ExternalLink className="ml-1.5 inline size-3" /></a>)}</div>
      </section>

      <SeoSection icon={Globe2} title="Publisher identity & entity SEO" description="Used by Organization/WebSite/SoftwareApplication structured data and publisher surfaces.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Publication name" value={settings.identity.publicationName} onChange={(value) => setSettings({ ...settings, identity: { ...settings.identity, publicationName: value } })} />
          <TextField label="Publisher / organization name" value={settings.identity.publisherName} onChange={(value) => setSettings({ ...settings, identity: { ...settings.identity, publisherName: value } })} />
          <div className="md:col-span-2"><TextField area label="Organization description" value={settings.identity.organizationDescription} onChange={(value) => setSettings({ ...settings, identity: { ...settings.identity, organizationDescription: value } })} /></div>
          <TextField label="Organization logo URL" value={settings.identity.organizationLogoUrl} onChange={(value) => setSettings({ ...settings, identity: { ...settings.identity, organizationLogoUrl: value } })} placeholder="/sellerhisab-mark-512.png" />
          <TextField label="Default social image URL" value={settings.identity.defaultSocialImageUrl} onChange={(value) => setSettings({ ...settings, identity: { ...settings.identity, defaultSocialImageUrl: value } })} placeholder="/og.svg" />
          <div className="md:col-span-2"><TextField area label="Official social/profile URLs — one per line" value={settings.identity.sameAs.join("\n")} onChange={(value) => setSettings({ ...settings, identity: { ...settings.identity, sameAs: lineList(value) } })} placeholder="https://www.linkedin.com/company/..." /></div>
        </div>
      </SeoSection>

      <SeoSection icon={ShieldCheck} title="Search Console & webmaster verification" description="Paste verification tokens only; DNS/domain verification can still be used independently.">
        <div className="grid gap-4 md:grid-cols-2"><TextField label="Google site verification token" value={settings.verification.googleSiteVerification} onChange={(value) => setSettings({ ...settings, verification: { ...settings.verification, googleSiteVerification: value } })} /><TextField label="Bing msvalidate.01 token" value={settings.verification.bingSiteVerification} onChange={(value) => setSettings({ ...settings, verification: { ...settings.verification, bingSiteVerification: value } })} /></div>
      </SeoSection>

      <SeoSection icon={Bot} title="Crawler policy" description="Safe toggles: private account/admin/payment routes stay blocked regardless of these public-crawler choices.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Toggle label="Googlebot" help="Google web search" checked={settings.crawlers.googlebot} onChange={(value) => updateCrawler("googlebot", value)} />
          <Toggle label="Googlebot-Image" help="Google Images / Discover images" checked={settings.crawlers.googleImage} onChange={(value) => updateCrawler("googleImage", value)} />
          <Toggle label="Googlebot-Video" help="Video search discovery" checked={settings.crawlers.googleVideo} onChange={(value) => updateCrawler("googleVideo", value)} />
          <Toggle label="Bingbot" help="Bing and Microsoft search ecosystem" checked={settings.crawlers.bingbot} onChange={(value) => updateCrawler("bingbot", value)} />
          <Toggle label="OAI-SearchBot" help="ChatGPT Search discovery" checked={settings.crawlers.oaiSearchbot} onChange={(value) => updateCrawler("oaiSearchbot", value)} />
          <Toggle label="GPTBot" help="Separate OpenAI model-training crawler control" checked={settings.crawlers.gptbot} onChange={(value) => updateCrawler("gptbot", value)} />
          <Toggle label="Google-Extended" help="Google AI-use control; separate from normal Search" checked={settings.crawlers.googleExtended} onChange={(value) => updateCrawler("googleExtended", value)} />
        </div>
      </SeoSection>

      <SeoSection icon={Newspaper} title="Discover, News, Images, Video & feeds" description="These control technical eligibility surfaces. They do not guarantee ranking or inclusion.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Toggle label="News sitemap" help="Fresh News posts from the last 48 hours" checked={settings.discovery.newsSitemapEnabled} onChange={(value) => updateDiscovery("newsSitemapEnabled", value)} />
          <Toggle label="Image sitemap" help="Crawlable blog hero images" checked={settings.discovery.imageSitemapEnabled} onChange={(value) => updateDiscovery("imageSitemapEnabled", value)} />
          <Toggle label="Video sitemap" help="Dedicated /videos watch pages" checked={settings.discovery.videoSitemapEnabled} onChange={(value) => updateDiscovery("videoSitemapEnabled", value)} />
          <Toggle label="RSS feed" help="/feed.xml publisher feed" checked={settings.discovery.rssEnabled} onChange={(value) => updateDiscovery("rssEnabled", value)} />
          <Toggle label="Experimental llms.txt" help="Optional machine-readable public URL guide" checked={settings.discovery.llmsTxtEnabled} onChange={(value) => updateDiscovery("llmsTxtEnabled", value)} />
          <Toggle label="Large image previews" help="max-image-preview:large for Discover/Search" checked={settings.discovery.discoverLargeImages} onChange={(value) => updateDiscovery("discoverLargeImages", value)} />
          <Toggle label="Google Preferred Sources CTA" help="Shows a user opt-in link on eligible articles" checked={settings.discovery.preferredSourcesEnabled} onChange={(value) => updateDiscovery("preferredSourcesEnabled", value)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><TextField label="Preferred Sources button label" value={settings.discovery.preferredSourcesLabel} onChange={(value) => updateDiscovery("preferredSourcesLabel", value)} /><TextField label="Google News publication language" value={settings.discovery.newsLanguage} onChange={(value) => updateDiscovery("newsLanguage", value)} placeholder="en" /></div>
      </SeoSection>

      <SeoSection icon={Send} title="IndexNow distribution" description="New/updated/deleted public content can notify participating search engines automatically; manual submission is also available.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle label="IndexNow enabled" help="Master switch" checked={settings.indexNow.enabled} onChange={(value) => setSettings({ ...settings, indexNow: { ...settings.indexNow, enabled: value } })} />
          <Toggle label="On publish" help="Submit published URLs" checked={settings.indexNow.submitOnPublish} onChange={(value) => setSettings({ ...settings, indexNow: { ...settings.indexNow, submitOnPublish: value } })} />
          <Toggle label="On update" help="Submit updated published URLs" checked={settings.indexNow.submitOnUpdate} onChange={(value) => setSettings({ ...settings, indexNow: { ...settings.indexNow, submitOnUpdate: value } })} />
          <Toggle label="On delete" help="Notify removed URLs" checked={settings.indexNow.submitOnDelete} onChange={(value) => setSettings({ ...settings, indexNow: { ...settings.indexNow, submitOnDelete: value } })} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><Textarea value={manualPaths} onChange={(event) => setManualPaths(event.target.value)} className="min-h-28" placeholder="/blog/my-post" /><Button onClick={submitIndexNow} disabled={indexNowBusy || !settings.indexNow.enabled} className="self-end rounded-xl">{indexNowBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}Submit now</Button></div>
      </SeoSection>

      <SeoSection icon={Link2} title="Redirect manager" description="Slug changes create redirects automatically. Add safe public-path redirects here when URLs move.">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><Input value={fromPath} onChange={(event) => setFromPath(event.target.value)} placeholder="/old-url" /><Input value={toPath} onChange={(event) => setToPath(event.target.value)} placeholder="/new-url" /><Button onClick={addRedirect} disabled={!fromPath.trim() || !toPath.trim()}><Plus className="mr-2 size-4" />Add 308</Button></div>
        <div className="mt-4 space-y-2">{redirects.slice(0, 100).map((item) => <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs sm:grid-cols-[1fr_auto_1fr_auto_auto] sm:items-center"><span className="break-all font-bold text-slate-700">{item.fromPath}</span><span>→</span><span className="break-all font-bold text-blue-700">{item.toPath}</span><span className="rounded-full bg-slate-100 px-2 py-1 font-black">{item.statusCode}</span><Button variant="ghost" size="icon" onClick={() => void removeRedirect(item.id)} aria-label="Delete redirect"><Trash2 className="size-4 text-red-600" /></Button></div>)}</div>
      </SeoSection>

      <SeoSection icon={Video} title="Future-scope readiness" description="Stored now so future locale/AI distribution work does not require another hardcoded foundation change.">
        <div className="grid gap-4 md:grid-cols-2"><TextField label="Default locale" value={settings.future.defaultLocale} onChange={(value) => setSettings({ ...settings, future: { ...settings.future, defaultLocale: value } })} placeholder="en-IN" /><TextField label="Available locales — comma separated" value={settings.future.availableLocales.join(", ")} onChange={(value) => setSettings({ ...settings, future: { ...settings.future, availableLocales: value.split(",").map((item) => item.trim()).filter(Boolean) } })} /></div>
        <div className="mt-4"><Toggle label="Activate separate Hindi/English article URLs" help="Growth opt-in: changes canonical URLs and redirects complete translations. Keep off for the current same-page bilingual strategy." checked={settings.future.localeUrlsEnabled} onChange={(value)=>setSettings({...settings,future:{...settings.future,localeUrlsEnabled:value}})}/></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Toggle label="AI-readable feeds" help="Controls experimental machine-readable publisher aids" checked={settings.future.aiReadableFeeds} onChange={(value) => setSettings({ ...settings, future: { ...settings.future, aiReadableFeeds: value } })} /><Toggle label="hreflang-ready architecture" help="Actual hreflang is emitted only when a post has explicit locale URL mappings" checked={settings.future.hreflangReady} onChange={(value) => setSettings({ ...settings, future: { ...settings.future, hreflangReady: value } })} /></div>
      </SeoSection>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950"><Search className="mr-2 inline size-5" /><span className="font-black">SEO safety:</span> no setting here promises ranking. Structured data must match visible content, private routes remain blocked, and FAQ rich-result schema is intentionally not added because that Google feature is deprecated.</div>
    </div>
  );
}

function SeoSection({ icon: Icon, title, description, children }: { icon: typeof Search; title: string; description: string; children: React.ReactNode }) {
  return <section className="liquid-panel rounded-[24px] p-5 sm:p-6"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div></div><div className="mt-5">{children}</div></section>;
}
function TextField({ label, value, onChange, placeholder, area = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; area?: boolean }) { return <div><Label className="text-xs font-extrabold text-slate-800">{label}</Label>{area ? <Textarea className="mt-2 min-h-24" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <Input className="mt-2 h-11" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</div>; }
function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 p-3"><span><span className="block text-xs font-black text-slate-900">{label}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{help}</span></span><Switch checked={checked} onCheckedChange={onChange} /></label>; }
function lineList(value: string) { return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))].slice(0, 20); }
