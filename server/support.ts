import { randomId } from "./crypto";
import { getD1 } from "./runtime";

export type SupportStatus = "open" | "in_progress" | "waiting_customer" | "resolved";
export type SupportPriority = "low" | "normal" | "high" | "urgent";

export function priorityForSubject(subject: string): SupportPriority {
  if (subject === "payment") return "high";
  if (subject === "account" || subject === "privacy") return "normal";
  return "normal";
}

export async function listSupportRequests() {
  const result = await getD1().prepare(`
    SELECT id, email, subject, category, priority, status, assigned_to AS assignedTo,
           resolution_note AS resolutionNote, resolved_at AS resolvedAt,
           created_at AS createdAt, COALESCE(updated_at, created_at) AS updatedAt,
           message
    FROM contact_requests
    ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
             CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'waiting_customer' THEN 2 ELSE 3 END,
             created_at DESC
    LIMIT 500
  `).all();
  return result.results ?? [];
}

export async function updateSupportRequest(input: {
  id: string;
  actorUserId: string;
  status?: SupportStatus;
  priority?: SupportPriority;
  assignedTo?: string | null;
  resolutionNote?: string | null;
}) {
  const db = getD1();
  const existing = await db.prepare("SELECT id, status, priority, assigned_to AS assignedTo FROM contact_requests WHERE id = ?1 LIMIT 1").bind(input.id).first<{ id: string; status: string; priority: string; assignedTo: string | null }>();
  if (!existing) throw new Error("Support request not found.");
  const status = input.status ?? (existing.status as SupportStatus);
  const priority = input.priority ?? (existing.priority as SupportPriority);
  const assignedTo = input.assignedTo === undefined ? existing.assignedTo : input.assignedTo;
  const note = input.resolutionNote?.trim().slice(0, 2000) || null;
  const now = new Date().toISOString();
  const resolvedAt = status === "resolved" ? now : null;
  await db.batch([
    db.prepare(`UPDATE contact_requests SET status = ?2, priority = ?3, assigned_to = ?4, resolution_note = ?5, resolved_at = ?6, updated_at = ?7 WHERE id = ?1`)
      .bind(input.id, status, priority, assignedTo, note, resolvedAt, now),
    db.prepare(`INSERT INTO support_request_events (id, support_request_id, actor_user_id, event_type, detail_json, created_at) VALUES (?1, ?2, ?3, 'support.updated', ?4, ?5)`)
      .bind(randomId("sev"), input.id, input.actorUserId, JSON.stringify({ status, priority, assignedTo, hasResolutionNote: Boolean(note) }), now),
  ]);
}
