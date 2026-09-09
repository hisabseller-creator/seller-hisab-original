"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Clipboard, Loader2, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProPlanLock } from "./pro-plan-lock";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatInr } from "@/core/money";
import type { WorkspaceRole } from "@/core/workspace/permissions";

type Member = { id: string; userId: string; role: WorkspaceRole; email: string | null; phone: string | null; name: string | null; createdAt: string };
type Invite = { id: string; email: string; role: WorkspaceRole; status: string; expiresAt: number; createdAt: string };
type WorkspaceAction = {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  expectedImpactPaise: number | null;
  confidenceBps: number;
  status: string;
  assigneeUserId: string | null;
  approvalRequired: boolean;
  approvalStatus: string;
};
type Audit = { id: string; action: string; resourceType: string; resourceId: string | null; createdAt: string; email: string | null; phone: string | null };
type WorkspacePayload = {
  tenant: { id: string; name: string; ownerUserId: string; createdAt: string };
  access: { tenantId: string; role: WorkspaceRole };
  availableWorkspaces: Array<{ id: string; name: string; role: WorkspaceRole }>;
  members: Member[];
  invites: Invite[];
  actions: WorkspaceAction[];
  recentAudit: Audit[];
};

const roleLabel: Record<WorkspaceRole, string> = { owner: "Owner", admin: "Admin", analyst: "Analyst", viewer: "Viewer" };

export function WorkspaceView() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceRole, "owner">>("analyst");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const searchParams = useSearchParams();
  const incomingInviteToken = inviteDismissed ? null : (searchParams.get("invite")?.trim() || null);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/workspace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { workspace?: WorkspacePayload; error?: string; requiredPlan?: string };
        if (response.status === 402) {
          if (active) { setPlanLocked(true); setLoadError(null); setWorkspace(null); }
          return;
        }
        if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Workspace could not be loaded.");
        if (active) { setPlanLocked(false); setLoadError(null); setWorkspace(payload.workspace); }
      })
      .catch((error) => {
        if (active) {
          const message = error instanceof Error ? error.message : "Workspace could not be loaded.";
          setLoadError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function mutate(body: Record<string, unknown>, success?: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/account/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { workspace?: WorkspacePayload; invite?: { token: string; expiresAt: number }; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Workspace update failed.");
      setWorkspace(payload.workspace);
      if (payload.invite?.token) {
        const link = `${window.location.origin}/app/workspace?invite=${encodeURIComponent(payload.invite.token)}`;
        setLastInviteLink(link);
      }
      if (success) toast.success(success);
      return payload;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace update failed.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const canManage = workspace?.access.role === "owner" || workspace?.access.role === "admin";
  const canApprove = canManage;
  const canOperate = workspace?.access.role !== "viewer";
  const assignable = useMemo(() => (workspace?.members ?? []).filter((member) => member.role !== "viewer"), [workspace]);

  if (loading) return <div className="mt-10 grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  if (planLocked) return <div className="mt-6 space-y-5"><div><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Professional Workspace</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Team access, action ownership and approval control stay behind the Pro workspace boundary.</p></div><ProPlanLock title="Professional Workspace requires Pro" description="Upgrade to Pro to manage workspace members, roles, action ownership and approval-controlled workflows." /></div>;
  if (!workspace) return <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">{loadError ?? "Workspace could not be loaded."}</div>;

  return <div className="mt-6 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Professional Workspace</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Team access, action ownership and approval control. SellerHisab records decisions; it does not auto-execute marketplace changes.</p></div>
      <div className="flex items-center gap-2"><div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700">Your role: {roleLabel[workspace.access.role]}</div>{workspace.availableWorkspaces.length > 1 && <Select value={workspace.tenant.id} onValueChange={(tenantId) => void mutate({ operation: "switch_workspace", tenantId }, "Workspace switched.")} disabled={busy}><SelectTrigger className="w-52 bg-white"><SelectValue /></SelectTrigger><SelectContent>{workspace.availableWorkspaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} • {roleLabel[item.role]}</SelectItem>)}</SelectContent></Select>}</div>
    </div>

    {incomingInviteToken && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm font-extrabold text-blue-950">Workspace invitation detected</p><p className="mt-1 text-xs leading-5 text-blue-800">Accept only if this invite was shared with the email account you are signed in with.</p><Button className="mt-3" disabled={busy} onClick={() => void mutate({ operation: "accept_invite", token: incomingInviteToken }, "Workspace invite accepted.").then((payload) => { if (payload) { setInviteDismissed(true); window.history.replaceState({}, "", "/app/workspace"); } })}>Accept workspace invite</Button></div>}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><UsersRound className="size-5 text-blue-600" /><div><h2 className="font-extrabold text-slate-950">{workspace.tenant.name}</h2><p className="text-xs text-slate-500">{workspace.members.length} member(s) • tenant-scoped operations</p></div></div>
      <div className="mt-5 grid gap-3">
        {workspace.members.map((member) => <div key={member.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
          <div><p className="text-sm font-extrabold text-slate-900">{member.name || member.email || member.phone || member.userId}</p><p className="mt-1 text-xs text-slate-500">{member.email ?? member.phone ?? member.userId}</p></div>
          <div className="flex items-center gap-2">
            {canManage && member.role !== "owner" ? <Select value={member.role} onValueChange={(role) => void mutate({ operation: "update_member_role", memberUserId: member.userId, role }, "Member role updated.")} disabled={busy}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="analyst">Analyst</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent>
            </Select> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{roleLabel[member.role]}</span>}
            {canManage && member.role !== "owner" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void mutate({ operation: "remove_member", memberUserId: member.userId }, "Member removed.")}><X className="mr-1 size-4" />Remove</Button>}
          </div>
        </div>)}
      </div>

      {canManage && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-center gap-2"><UserPlus className="size-4 text-blue-700" /><p className="text-sm font-extrabold text-blue-950">Invite teammate</p></div>
        <p className="mt-1 text-xs leading-5 text-blue-800">SellerHisab does not send an email in F10. Generate a single-use 7-day invite link and share it privately.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px_auto]"><Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com" /><Select value={inviteRole} onValueChange={(value) => setInviteRole(value as Exclude<WorkspaceRole, "owner">)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workspace.access.role === "owner" && <SelectItem value="admin">Admin</SelectItem>}<SelectItem value="analyst">Analyst</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select><Button disabled={busy || !inviteEmail.trim()} onClick={() => void mutate({ operation: "create_invite", email: inviteEmail, role: inviteRole }, "Invite link created.").then((payload) => { if (payload) setInviteEmail(""); })}>Create invite</Button></div>
        {lastInviteLink && <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-white p-3"><code className="min-w-0 flex-1 truncate text-xs text-slate-700">{lastInviteLink}</code><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(lastInviteLink).then(() => toast.success("Invite link copied."))}><Clipboard className="mr-1 size-4" />Copy</Button></div>}
        {workspace.invites.length > 0 && <div className="mt-4 space-y-2">{workspace.invites.map((invite) => <div key={invite.id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-600">{invite.email} • {roleLabel[invite.role]} • expires {new Date(invite.expiresAt).toLocaleDateString("en-IN")}</span><Button variant="ghost" size="sm" onClick={() => void mutate({ operation: "cancel_invite", inviteId: invite.id }, "Invite cancelled.")}>Cancel</Button></div>)}</div>}
      </div>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-emerald-600" /><div><h2 className="font-extrabold text-slate-950">Action ownership & approvals</h2><p className="text-xs text-slate-500">Open tenant action recommendations from cash, ads and inventory.</p></div></div>
      <div className="mt-5 space-y-3">
        {workspace.actions.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No open tenant actions right now.</p>}
        {workspace.actions.map((action) => <div key={action.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold text-slate-900">{action.actionType}</p>{action.approvalRequired && <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${action.approvalStatus === "approved" ? "bg-emerald-100 text-emerald-700" : action.approvalStatus === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{action.approvalStatus.replaceAll("_", " ")}</span>}</div><p className="mt-1 text-xs text-slate-500">{action.targetType}{action.targetId ? ` • ${action.targetId}` : ""} • confidence {(action.confidenceBps / 100).toFixed(0)}%</p></div><p className="text-sm font-extrabold tabular-nums text-slate-900">{action.expectedImpactPaise ? formatInr(action.expectedImpactPaise) : "—"}</p></div>
          {canOperate && <div className="mt-4 flex flex-wrap items-center gap-2"><Select value={action.assigneeUserId ?? "unassigned"} onValueChange={(value) => void mutate({ operation: "assign_action", actionId: action.id, assigneeUserId: value === "unassigned" ? null : value }, "Action owner updated.")} disabled={busy}><SelectTrigger className="w-48"><SelectValue placeholder="Assign owner" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{assignable.map((member) => <SelectItem key={member.userId} value={member.userId}>{member.name || member.email || member.phone || roleLabel[member.role]}</SelectItem>)}</SelectContent></Select>
            {action.approvalStatus !== "pending" && action.approvalStatus !== "approved" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void mutate({ operation: "request_approval", actionId: action.id }, "Approval requested.")}>Request approval</Button>}
            {canApprove && action.approvalStatus === "pending" && <><Button size="sm" disabled={busy} onClick={() => void mutate({ operation: "approve_action", actionId: action.id }, "Action approved.")}><Check className="mr-1 size-4" />Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void mutate({ operation: "reject_action", actionId: action.id }, "Action rejected.")}><X className="mr-1 size-4" />Reject</Button></>}
            <Button size="sm" variant="outline" disabled={busy || (action.approvalRequired && action.approvalStatus !== "approved")} onClick={() => void mutate({ operation: "complete_action", actionId: action.id }, "Action marked complete.")}>Mark complete</Button>
          </div>}
        </div>)}
      </div>
    </section>

    {canManage && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-950">Recent audit trail</h2><div className="mt-4 space-y-2">{workspace.recentAudit.length === 0 ? <p className="text-sm text-slate-500">No workspace audit events yet.</p> : workspace.recentAudit.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 text-xs"><span className="font-semibold text-slate-700">{item.action}</span><span className="text-slate-500">{item.email ?? item.phone ?? "system"} • {new Date(item.createdAt).toLocaleString("en-IN")}</span></div>)}</div></section>}
  </div>;
}
