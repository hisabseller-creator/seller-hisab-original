"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SupportRequest = {
  id: string; email: string; subject: string; category: string; priority: string; status: string;
  assignedTo: string | null; resolutionNote: string | null; resolvedAt: string | null;
  createdAt: string; updatedAt: string; message: string;
};

export function AdminSupportManager() {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/support", { cache: "no-store" });
    const payload = await response.json() as { requests?: SupportRequest[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Support queue could not be loaded.");
    setItems(payload.requests ?? []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
        .catch((error) => toast.error(error instanceof Error ? error.message : "Support queue failed."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function update(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    try {
      const response = await fetch("/api/admin/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
      const payload = await response.json() as { requests?: SupportRequest[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Support request could not be updated.");
      setItems(payload.requests ?? []);
      toast.success("Support request updated.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Support update failed."); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  return <section><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.13em] text-blue-600">Customer operations</p><h1 className="mt-2 text-2xl font-extrabold tracking-[-.035em] text-slate-950">Support queue</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Payment and account-access cases are prioritized. Never ask customers for marketplace passwords, OTPs, session cookies or full bank statements.</p></div><Button variant="outline" onClick={() => load()}><RefreshCw className="mr-2 size-4" />Refresh</Button></div>
    <div className="mt-6 space-y-4">{items.length ? items.map((item) => <SupportCard key={item.id} item={item} busy={busy === item.id} onUpdate={update} />) : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No support requests.</div>}</div>
  </section>;
}

function SupportCard({ item, busy, onUpdate }: { item: SupportRequest; busy: boolean; onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void> }) {
  const [assignedTo, setAssignedTo] = useState(item.assignedTo ?? "");
  const [note, setNote] = useState(item.resolutionNote ?? "");
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">{item.subject}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.priority === "urgent" || item.priority === "high" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{item.priority}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">{item.status.replace("_", " ")}</span></div><p className="mt-3 text-sm font-extrabold text-slate-900">{item.email} <span className="font-medium text-slate-400">• {item.id}</span></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p><p className="mt-2 text-xs text-slate-400">Created {new Date(item.createdAt).toLocaleString("en-IN")}</p></div></div>
    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><Input aria-label={`Assignee for ${item.id}`} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Assignee/team name" /><select aria-label={`Status for ${item.id}`} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={item.status} onChange={(event) => void onUpdate(item.id, { status: event.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_customer">Waiting customer</option><option value="resolved">Resolved</option></select><select aria-label={`Priority for ${item.id}`} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={item.priority} onChange={(event) => void onUpdate(item.id, { priority: event.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
    <Textarea aria-label={`Resolution note for ${item.id}`} className="mt-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal resolution / safe reply note" maxLength={2000} />
    <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy} onClick={() => onUpdate(item.id, { assignedTo: assignedTo || null, resolutionNote: note || null })}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Save triage</Button>{item.status !== "resolved" && <Button size="sm" variant="outline" disabled={busy} onClick={() => onUpdate(item.id, { status: "resolved", assignedTo: assignedTo || null, resolutionNote: note || "Resolved by support." })}>Resolve</Button>}</div></article>;
}
