"use client";
import { localeDiagnostics } from "@/core/blog-locales";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, ImageUp, Loader2, Pencil, Plus, Save, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_BLOG_VIDEO, type BlogContentType, type BlogPostRecord, type BlogPostStatus } from "@/core/blog-cms";
import { auditBlogSeo } from "@/core/seo-diagnostics";

const EMPTY_HTML = "";

type Draft = Omit<BlogPostRecord, "id" | "readTime" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string };

const emptyDraft = (): Draft => ({
  id: undefined,
  slug: "",
  title: "",
  subtitle: "",
  tag: "Seller Profit",
  category: "Seller Profit",
  tags: [],
  keywords: [],
  imageKey: null,
  imageUrl: null,
  imageAlt: "",
  imageWidth: null,
  imageHeight: null,
  imageCaption: "",
  imageCredit: "",
  htmlContent: EMPTY_HTML,
  htmlContentEn: "",
  status: "draft",
  featured: false,
  contentType: "blog",
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  indexable: true,
  follow: true,
  discoverEnabled: true,
  newsEnabled: true,
  preferredSourceCta: true,
  authorName: "SellerHisab Research Team",
  authorUrl: "/authors/sellerhisab-research",
  reviewedAt: null,
  publishedAt: null,
  sourceUrls: [],
  relatedSlugs: [],
  localeAlternates: [],
  video: { ...EMPTY_BLOG_VIDEO },
});

export function AdminBlogManager() {
  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadPosts() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/blog", { cache: "no-store" });
      const payload = await response.json() as { posts?: BlogPostRecord[]; error?: string };
      if (!response.ok || !payload.posts) throw new Error(payload.error ?? "Blog posts could not be loaded.");
      setPosts(payload.posts);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Blog posts could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPosts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const audit = useMemo(() => auditBlogSeo({
    id: draft.id,
    slug: draft.slug,
    title: draft.title,
    subtitle: draft.subtitle,
    tag: draft.tag,
    category: draft.category,
    tags: draft.tags,
    keywords: draft.keywords,
    imageKey: draft.imageKey,
    imageAlt: draft.imageAlt,
    imageWidth: draft.imageWidth,
    imageHeight: draft.imageHeight,
    imageCaption: draft.imageCaption,
    imageCredit: draft.imageCredit,
    htmlContent: draft.htmlContent.trim() || draft.htmlContentEn.trim(),
    status: draft.status,
    featured: draft.featured,
    contentType: draft.contentType,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    canonicalUrl: draft.canonicalUrl,
    indexable: draft.indexable,
    follow: draft.follow,
    discoverEnabled: draft.discoverEnabled,
    newsEnabled: draft.newsEnabled,
    preferredSourceCta: draft.preferredSourceCta,
    authorName: draft.authorName,
    authorUrl: draft.authorUrl,
    reviewedAt: draft.reviewedAt,
    publishedAt: draft.publishedAt,
    sourceUrls: draft.sourceUrls,
    relatedSlugs: draft.relatedSlugs,
    localeAlternates: draft.localeAlternates,
    video: draft.video,
  }), [draft]);

  function startNew() { setDraft(emptyDraft()); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function editPost(post: BlogPostRecord) { setDraft({ ...post }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", draft.title || "article-image");
      const response = await fetch("/api/admin/blog/media", { method: "POST", body: formData });
      const payload = await response.json() as { imageKey?: string; imageUrl?: string; width?: number; height?: number; error?: string };
      if (!response.ok || !payload.imageKey || !payload.imageUrl) throw new Error(payload.error ?? "Image upload failed.");
      setDraft((current) => ({ ...current, imageKey: payload.imageKey ?? null, imageUrl: payload.imageUrl ?? null, imageWidth: payload.width ?? null, imageHeight: payload.height ?? null, imageAlt: current.imageAlt || current.title }));
      toast.success("Discover-ready hero image uploaded.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Image upload failed."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function save(status: BlogPostStatus) {
    if (!draft.title.trim() || !draft.subtitle.trim() || !draft.tag.trim() || (!draft.htmlContent.trim() && !draft.htmlContentEn.trim())) { toast.error("Title, subtitle, tag and at least one article language are required."); return; }
    if (status === "published" && audit.diagnostics.some((item) => item.level === "error")) { toast.error("Fix the red SEO checks before publishing. Draft saving is still allowed."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/blog", {
        method: draft.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, readTime: undefined, status, imageUrl: undefined, createdAt: undefined, updatedAt: undefined }),
      });
      const payload = await response.json() as { post?: BlogPostRecord; error?: string };
      if (!response.ok || !payload.post) throw new Error(payload.error ?? "Blog post could not be saved.");
      toast.success(status === "published" ? "Post published with SEO distribution hooks." : "Draft saved.");
      await loadPosts();
      editPost(payload.post);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Blog post could not be saved."); }
    finally { setSaving(false); }
  }

  async function remove(post: BlogPostRecord) {
    if (!window.confirm(`Delete “${post.title}”? A 308 redirect to /blog will be created automatically.`)) return;
    const response = await fetch("/api/admin/blog", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: post.id }) });
    const payload = await response.json() as { deleted?: boolean; error?: string };
    if (!response.ok || !payload.deleted) { toast.error(payload.error ?? "Blog post could not be deleted."); return; }
    if (draft.id === post.id) setDraft(emptyDraft());
    toast.success("Post deleted and legacy URL protected by redirect.");
    await loadPosts();
  }

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-5">
      <section className="liquid-panel rounded-[26px] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">All-surface content editor</p><h1 className="mt-1 text-2xl font-black tracking-[-.035em] text-slate-950">{draft.id ? "Edit content" : "Create search-ready content"}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">One editor controls Search, Discover, News, Images, Video, social previews, AI/search crawlers and internal distribution.</p></div><Button variant="outline" onClick={startNew}><Plus className="mr-2 size-4" />New post</Button></div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Field label="Visible title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What changed and why it matters" /></Field>
          <Field label="URL slug"><Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="auto-generated from title" /></Field>
          <div className="lg:col-span-2"><Field label="Visible subtitle / summary"><Textarea value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} className="min-h-24" /></Field></div>
          <Field label="Content type"><select value={draft.contentType} onChange={(e) => setDraft({ ...draft, contentType: e.target.value as BlogContentType })} className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="blog">BlogPosting</option><option value="article">Article</option><option value="news">NewsArticle</option></select></Field>
          <Field label="Primary category"><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, tag: e.target.value || draft.tag })} placeholder="Returns & RTO" /></Field>
          <Field label="Card tag"><Input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} /></Field>
          <Field label="Tags — comma separated"><Input value={draft.tags.join(", ")} onChange={(e) => setDraft({ ...draft, tags: commaList(e.target.value) })} /></Field>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_.9fr]">
          <div><Label className="text-xs font-extrabold text-slate-800">Discover / social hero image</Label><div className="mt-2 overflow-hidden rounded-[22px] border border-slate-200 bg-white/70"><div className="relative h-56 bg-gradient-to-br from-blue-50 to-indigo-50">{draft.imageUrl ? <Image src={draft.imageUrl} alt={draft.imageAlt || draft.title || "Blog image"} fill unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-xs font-bold text-slate-400">1200px+ landscape image</div>}</div><div className="flex flex-wrap items-center gap-2 p-3"><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); }} /><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ImageUp className="mr-2 size-4" />}{draft.imageUrl ? "Replace" : "Upload"}</Button>{draft.imageWidth && draft.imageHeight ? <span className="text-[11px] text-slate-500">{draft.imageWidth}×{draft.imageHeight}</span> : null}</div></div></div>
          <div className="space-y-4"><Field label="Image alt text"><Input value={draft.imageAlt} onChange={(e) => setDraft({ ...draft, imageAlt: e.target.value })} /></Field><Field label="Image caption"><Input value={draft.imageCaption} onChange={(e) => setDraft({ ...draft, imageCaption: e.target.value })} /></Field><Field label="Image credit / source"><Input value={draft.imageCredit} onChange={(e) => setDraft({ ...draft, imageCredit: e.target.value })} /></Field></div>
        </div>

        <div className="mt-6">
          <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs font-semibold leading-5 text-blue-900">
            Hindi HTML, English HTML या दोनों add कर सकते हैं। दोनों होंगे तो article पर Hindi / English switch दिखेगा।
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Field label="Hindi Article HTML - optional">
              <Textarea
                value={draft.htmlContent}
                onChange={(e) => setDraft({ ...draft, htmlContent: e.target.value })}
                className="min-h-[420px] font-mono text-xs leading-6"
                placeholder="<h2>हिंदी article HTML</h2>"
              />
            </Field>
            <Field label="English Article HTML - optional">
              <Textarea
                value={draft.htmlContentEn}
                onChange={(e) => setDraft({ ...draft, htmlContentEn: e.target.value })}
                className="min-h-[420px] font-mono text-xs leading-6"
                placeholder="<h2>English article HTML</h2>"
              />
            </Field>
          </div>
        </div>
      </section>

      <details className="liquid-panel rounded-[24px] p-5 sm:p-6"><summary className="cursor-pointer font-black">Hindi / English search editions</summary>
        <p className="mt-3 text-sm">A locale URL activates only when its title, summary and article body are complete. Existing shared article URLs keep working.</p>
        {(["hi","en"] as const).map(locale=><fieldset key={locale} className="mt-5 grid gap-3"><legend className="font-bold">{locale==="hi"?"हिंदी":"English"}</legend>{(["title","subtitle","seoTitle","seoDescription"] as const).map(field=><Field key={field} label={locale+" "+field}><Input value={draft.localeMetadata?.[locale]?.[field]??""} onChange={e=>setDraft({...draft,localeMetadata:{...draft.localeMetadata,[locale]:{title:"",subtitle:"",seoTitle:"",seoDescription:"",...draft.localeMetadata?.[locale],[field]:e.target.value}}})}/></Field>)}</fieldset>)}
        <ul className="mt-4 text-sm">{localeDiagnostics({...draft,id:draft.id??"draft",readTime:"",createdAt:draft.createdAt??"",updatedAt:draft.updatedAt??""}).map(d=><li key={d.locale}>{d.locale}: {d.indexable?"Search edition ready":"Needs locale title, summary and body (or custom canonical is active)"}</li>)}</ul>
      </details>
      <details open className="liquid-panel rounded-[24px] p-5 sm:p-6"><summary className="cursor-pointer text-base font-black text-slate-950">Search metadata, canonical & index controls</summary><div className="mt-5 grid gap-4 lg:grid-cols-2"><Field label="SEO title (blank = visible title)"><Input value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} /></Field><Field label="Canonical URL (blank = self canonical)"><Input value={draft.canonicalUrl} onChange={(e) => setDraft({ ...draft, canonicalUrl: e.target.value })} placeholder="/blog/my-post" /></Field><div className="lg:col-span-2"><Field label="Meta description (blank = subtitle)"><Textarea value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} className="min-h-20" /></Field></div><Field label="SEO keywords — comma separated"><Input value={draft.keywords.join(", ")} onChange={(e) => setDraft({ ...draft, keywords: commaList(e.target.value) })} /></Field><Field label="Related post slugs — comma separated"><Input value={draft.relatedSlugs.join(", ")} onChange={(e) => setDraft({ ...draft, relatedSlugs: commaList(e.target.value) })} /></Field></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Toggle label="Indexable" checked={draft.indexable} onChange={(value) => setDraft({ ...draft, indexable: value })} /><Toggle label="Follow links" checked={draft.follow} onChange={(value) => setDraft({ ...draft, follow: value })} /><Toggle label="Discover eligible" checked={draft.discoverEnabled} onChange={(value) => setDraft({ ...draft, discoverEnabled: value })} /><Toggle label="News sitemap eligible" checked={draft.newsEnabled} onChange={(value) => setDraft({ ...draft, newsEnabled: value })} /><Toggle label="Preferred Sources CTA" checked={draft.preferredSourceCta} onChange={(value) => setDraft({ ...draft, preferredSourceCta: value })} /><Toggle label="Featured on blog" checked={draft.featured} onChange={(value) => setDraft({ ...draft, featured: value })} /></div></details>

      <details className="liquid-panel rounded-[24px] p-5 sm:p-6"><summary className="cursor-pointer text-base font-black text-slate-950">Author, freshness, sources & locale alternates</summary><div className="mt-5 grid gap-4 lg:grid-cols-2"><Field label="Author name"><Input value={draft.authorName} onChange={(e) => setDraft({ ...draft, authorName: e.target.value })} /></Field><Field label="Author profile URL"><Input value={draft.authorUrl} onChange={(e) => setDraft({ ...draft, authorUrl: e.target.value })} /></Field><Field label="Published at (ISO, optional override)"><Input value={draft.publishedAt ?? ""} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value || null })} placeholder="2026-09-07T12:00:00+05:30" /></Field><Field label="Reviewed at (ISO)"><Input value={draft.reviewedAt ?? ""} onChange={(e) => setDraft({ ...draft, reviewedAt: e.target.value || null })} placeholder="2026-09-07T12:00:00+05:30" /></Field><div className="lg:col-span-2"><Field label="Primary/official source URLs — one per line"><Textarea value={draft.sourceUrls.join("\n")} onChange={(e) => setDraft({ ...draft, sourceUrls: lineList(e.target.value) })} className="min-h-24" /></Field></div><div className="lg:col-span-2"><Field label="hreflang locale mappings — locale=url, one per line"><Textarea value={draft.localeAlternates.map((item) => `${item.locale}=${item.url}`).join("\n")} onChange={(e) => setDraft({ ...draft, localeAlternates: parseLocaleLines(e.target.value) })} placeholder="hi-IN=/hi/blog/example" className="min-h-20" /></Field></div></div></details>

      <details className="liquid-panel rounded-[24px] p-5 sm:p-6"><summary className="cursor-pointer text-base font-black text-slate-950">Video SEO & dedicated watch page</summary><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="lg:col-span-2"><Toggle label="Enable VideoObject + /videos watch page" checked={draft.video.enabled} onChange={(value) => setDraft({ ...draft, video: { ...draft.video, enabled: value } })} /></div><Field label="Video title"><Input value={draft.video.title} onChange={(e) => setDraft({ ...draft, video: { ...draft.video, title: e.target.value } })} /></Field><Field label="Thumbnail URL"><Input value={draft.video.thumbnailUrl} onChange={(e) => setDraft({ ...draft, video: { ...draft.video, thumbnailUrl: e.target.value } })} /></Field><div className="lg:col-span-2"><Field label="Video description"><Textarea value={draft.video.description} onChange={(e) => setDraft({ ...draft, video: { ...draft.video, description: e.target.value } })} /></Field></div><Field label="Embed URL (YouTube/Vimeo/player)"><Input value={draft.video.embedUrl} onChange={(e) => setDraft({ ...draft, video: { ...draft.video, embedUrl: e.target.value } })} /></Field><Field label="Direct content URL (optional)"><Input value={draft.video.contentUrl} onChange={(e) => setDraft({ ...draft, video: { ...draft.video, contentUrl: e.target.value } })} /></Field><Field label="Duration seconds"><Input type="number" value={draft.video.durationSeconds ?? ""} onChange={(e) => setDraft({ ...draft, video: { ...draft.video, durationSeconds: e.target.value ? Number(e.target.value) : null } })} /></Field><Field label="Upload date (ISO)"><Input value={draft.video.uploadDate ?? ""} onChange={(e) => setDraft({ ...draft, video: { ...draft.video, uploadDate: e.target.value || null } })} /></Field></div></details>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-blue-700">Pre-publish SEO audit</p><h2 className="mt-1 text-xl font-black text-slate-950">Score {audit.score}/100</h2></div><Search className="size-6 text-blue-600" /></div><div className="mt-4 grid gap-2 lg:grid-cols-2">{audit.diagnostics.map((item) => <div key={item.code} className={`rounded-xl border px-3 py-2 text-xs font-semibold leading-5 ${item.level === "error" ? "border-red-200 bg-red-50 text-red-800" : item.level === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{item.message}</div>)}</div><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void save("draft")} disabled={saving}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save draft</Button><Button onClick={() => void save("published")} disabled={saving || audit.diagnostics.some((item) => item.level === "error")} className="liquid-button font-black"><FileText className="mr-2 size-4" />Publish</Button></div></section>

      <section className="liquid-panel rounded-[24px] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-blue-700">Library</p><h2 className="mt-1 text-xl font-black text-slate-950">All posts</h2></div><span className="text-xs font-bold text-slate-500">{posts.length} total</span></div><div className="mt-4 space-y-2">{posts.map((post) => <div key={post.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap gap-2"><span className="text-[10px] font-black uppercase text-blue-700">{post.contentType}</span>{post.featured ? <Star className="size-3.5 fill-amber-400 text-amber-400" /> : null}<span className="text-[10px] font-black uppercase text-slate-400">{post.status}</span>{!post.indexable ? <span className="text-[10px] font-black uppercase text-red-600">noindex</span> : null}</div><p className="mt-1 text-sm font-black text-slate-900">{post.title}</p><p className="mt-1 text-[11px] text-slate-500">/blog/{post.slug}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => editPost(post)}><Pencil className="mr-1.5 size-3.5" />Edit</Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => void remove(post)}><Trash2 className="mr-1.5 size-3.5" />Delete</Button></div></div>)}</div></section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="text-xs font-extrabold text-slate-800">{label}</Label><div className="mt-2">{children}</div></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 p-3"><span className="text-xs font-black text-slate-800">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></label>; }
function commaList(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 30); }
function lineList(value: string) { return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))].slice(0, 30); }
function parseLocaleLines(value: string) { return value.split(/\r?\n/).map((line) => { const index = line.indexOf("="); return index > 0 ? { locale: line.slice(0, index).trim(), url: line.slice(index + 1).trim() } : null; }).filter((item): item is { locale: string; url: string } => Boolean(item?.locale && item.url)).slice(0, 12); }
