"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("parser");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, subject, message }), signal: AbortSignal.timeout(20_000) });
      const payload = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !payload.reference) { setError(payload.error ?? "Request could not be sent."); return; }
      setReference(payload.reference); setMessage("");
    } catch {
      setError("We could not confirm delivery. Your message is still here. Check your connection before trying again.");
    } finally {
      setLoading(false);
    }
  }
  if (reference) return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="size-8 text-emerald-600" /><h2 className="mt-4 text-lg font-extrabold text-emerald-950">Support request received</h2><p className="mt-2 text-sm leading-6 text-emerald-900">Reference: <span className="font-mono font-bold">{reference}</span>. Save this reference for future follow-up.</p><Button variant="outline" className="mt-5" onClick={() => setReference("")}>Send another request</Button></div>;
  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="contact-email" className="text-xs font-bold">Email</Label><Input id="contact-email" type="email" required autoComplete="email" className="mt-2" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div><Label htmlFor="contact-subject" className="text-xs font-bold">Issue type</Label><Select value={subject} onValueChange={setSubject}><SelectTrigger id="contact-subject" className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="parser">New report / parser</SelectItem><SelectItem value="payment">Payment or refund</SelectItem><SelectItem value="account">Account</SelectItem><SelectItem value="privacy">Privacy</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><div className="mt-5"><Label htmlFor="contact-message" className="text-xs font-bold">Message</Label><Textarea id="contact-message" required minLength={20} maxLength={2000} className="mt-2 min-h-36" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add the analysis reference, parser version or payment ID. Do not paste raw report rows." /><p className="mt-1 text-right text-[11px] text-slate-600">{message.length}/2000</p></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}<Button type="submit" className="mt-5 bg-blue-600 font-bold" disabled={loading}>{loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}Submit support request</Button></form>;
}
