"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccountStatus } from "@/components/providers";

type Status = {
  enabled: boolean;
  pending: boolean;
  enabledAt: string | null;
  passwordChangedAt: string | null;
  passwordExpired: boolean;
  unlocked: boolean;
};

export function AdminSecurityBoundary({ children }: { children: React.ReactNode }) {
  const { user, loading: accountLoading } = useAccountStatus();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/admin/mfa", { cache: "no-store" });
      const payload = await response.json() as Status & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Admin security status could not be loaded.");
      setStatus(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin security status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (accountLoading || loading) return <LoadingCard />;
  if (!user?.isAdmin) return <>{children}</>;
  if (!status) return <SecurityShell title="Security check unavailable" text="Reload the page and try again." />;
  if (recoveryCodes.length) {
    return (
      <SecurityShell title="Save your recovery codes" text="Each code works once. Store them in your password manager; SellerHisab will not show them again.">
        <pre className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-5 text-sm leading-7 text-white">{recoveryCodes.join("\n")}</pre>
        <Button className="mt-5 w-full" onClick={() => { setRecoveryCodes([]); setCode(""); setPassword(""); void refresh(); }}>I saved these codes</Button>
      </SecurityShell>
    );
  }
  if (status.passwordExpired) return <ExpiredPassword mfaEnabled={status.enabled} onComplete={refresh} />;
  if (!status.enabled) {
    return (
      <SecurityShell title="Set up admin MFA" text="Admin access requires your password plus a code from an authenticator app.">
        {!secret ? (
          <form className="mt-5 space-y-4" onSubmit={async (event) => {
            event.preventDefault(); setBusy(true);
            try {
              const response = await fetch("/api/admin/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setup", currentPassword: password }) });
              const payload = await response.json() as { secret?: string; error?: string };
              if (!response.ok || !payload.secret) throw new Error(payload.error ?? "MFA setup could not start.");
              setSecret(payload.secret);
            } catch (error) { toast.error(error instanceof Error ? error.message : "MFA setup could not start."); }
            finally { setBusy(false); }
          }}>
            <Field label="Current admin password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
            <Button type="submit" className="w-full" disabled={busy || !password}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Start MFA setup</Button>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-800">
              In Google Authenticator, Microsoft Authenticator, 1Password or another TOTP app, add an account manually using this secret:
              <div className="mt-3 break-all rounded-xl bg-white p-3 font-mono font-bold tracking-wider">{secret}</div>
            </div>
            <form className="space-y-4" onSubmit={async (event) => {
              event.preventDefault(); setBusy(true);
              try {
                const response = await fetch("/api/admin/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm", code }) });
                const payload = await response.json() as { recoveryCodes?: string[]; error?: string };
                if (!response.ok || !payload.recoveryCodes) throw new Error(payload.error ?? "Authenticator code could not be verified.");
                setRecoveryCodes(payload.recoveryCodes); setSecret("");
              } catch (error) { toast.error(error instanceof Error ? error.message : "Authenticator code could not be verified."); }
              finally { setBusy(false); }
            }}>
              <Field label="6-digit authenticator code" value={code} onChange={setCode} inputMode="numeric" autoComplete="one-time-code" />
              <Button type="submit" className="w-full" disabled={busy || code.trim().length < 6}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Verify and enable MFA</Button>
            </form>
          </div>
        )}
      </SecurityShell>
    );
  }
  if (!status.unlocked) {
    return (
      <SecurityShell title="Unlock admin tools" text="Enter your admin password and current authenticator code. A recovery code can be used if your authenticator is unavailable.">
        <form className="mt-5 space-y-4" onSubmit={async (event) => {
          event.preventDefault(); setBusy(true);
          try {
            const response = await fetch("/api/admin/step-up", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, code }) });
            const payload = await response.json() as { ok?: boolean; error?: string };
            if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Admin verification failed.");
            setPassword(""); setCode(""); await refresh();
          } catch (error) { toast.error(error instanceof Error ? error.message : "Admin verification failed."); }
          finally { setBusy(false); }
        }}>
          <Field label="Admin password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          <Field label="Authenticator or recovery code" value={code} onChange={setCode} autoComplete="one-time-code" />
          <Button type="submit" className="w-full" disabled={busy || !password || code.trim().length < 6}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Verify admin access</Button>
        </form>
      </SecurityShell>
    );
  }
  return <>{children}</>;
}

function ExpiredPassword({ mfaEnabled, onComplete }: { mfaEnabled: boolean; onComplete: () => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <SecurityShell title="Change expired admin password" text="Admin passwords have a 365-day maximum age. Use a new password that has not been used in the last 10 changes.">
      <form className="mt-5 space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (newPassword !== confirm) { toast.error("New password and confirmation do not match."); return; }
        setBusy(true);
        try {
          const response = await fetch("/api/admin/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword, code: mfaEnabled ? code : undefined }) });
          const payload = await response.json() as { ok?: boolean; error?: string };
          if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Password could not be changed.");
          toast.success("Password changed. Verify MFA again to unlock admin tools.");
          setCurrentPassword(""); setNewPassword(""); setConfirm(""); setCode("");
          await onComplete();
        } catch (error) { toast.error(error instanceof Error ? error.message : "Password could not be changed."); }
        finally { setBusy(false); }
      }}>
        <Field label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
        {mfaEnabled && <Field label="Authenticator or recovery code" value={code} onChange={setCode} autoComplete="one-time-code" />}
        <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
        <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <Button type="submit" className="w-full" disabled={busy || !currentPassword || !newPassword || !confirm || (mfaEnabled && code.trim().length < 6)}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Change password</Button>
      </form>
    </SecurityShell>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; inputMode?: "numeric" }) {
  const id = props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <div><Label htmlFor={id}>{props.label}</Label><Input id={id} className="mt-2" type={props.type} value={props.value} onChange={(event) => props.onChange(event.target.value)} autoComplete={props.autoComplete} inputMode={props.inputMode} required /></div>;
}

function SecurityShell({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return <div className="app-wallpaper grid min-h-screen place-items-center p-4"><div className="glass-panel w-full max-w-lg rounded-[28px] p-6 sm:p-8"><ShieldCheck className="size-8 text-blue-600" /><h1 className="mt-4 text-2xl font-black text-slate-950">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>{children}</div></div>;
}

function LoadingCard() {
  return <div className="app-wallpaper grid min-h-screen place-items-center"><Loader2 className="size-7 animate-spin text-blue-600" /></div>;
}
