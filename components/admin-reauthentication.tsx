"use client";
import { useEffect, useRef, useState } from "react";

export function AdminReauthentication() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
      if (url.origin === location.origin && url.pathname.startsWith("/api/admin/") && response.status === 401) {
        const body = await response.clone().json().catch(() => ({}));
        if ((body as { code?: string }).code === "admin_step_up_required") dialog.current?.showModal();
      }
      return response;
    };
    return () => { window.fetch = original; };
  }, []);

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/step-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => ({})) as { code?: string; error?: string };
    setPassword("");
    if (response.ok) {
      setError("");
      dialog.current?.close();
      return;
    }
    if (payload.code === "password_reset_required") {
      setError("This admin credential needs a one-time OTP password reset. Sign out, then use Forgot your password on the login screen before retrying this action.");
      return;
    }
    setError(payload.error || "Could not confirm your password. Please try again.");
  }

  return <dialog ref={dialog} aria-labelledby="admin-reauth-title" className="m-auto max-w-sm rounded-2xl p-6 backdrop:bg-black/40">
    <form onSubmit={confirm}>
      <h2 id="admin-reauth-title" className="font-bold">Confirm admin access</h2>
      <p className="my-3 text-sm">Enter your password, then retry the action. Confirmation lasts ten minutes.</p>
      <label htmlFor="admin-reauth-password">Current password</label>
      <input id="admin-reauth-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="my-3 min-h-11 w-full rounded border px-3" />
      {error ? <p role="alert">{error}</p> : null}
      <div className="flex gap-3">
        <button type="submit" className="min-h-11 rounded bg-blue-700 px-4 text-white">Confirm</button>
        <button type="button" className="min-h-11 px-4" onClick={() => { setPassword(""); setError(""); dialog.current?.close(); }}>Cancel</button>
      </div>
    </form>
  </dialog>;
}
