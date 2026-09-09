import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { randomId } from "@/server/crypto";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getD1 } from "@/server/runtime";
import { priorityForSubject } from "@/server/support";

export const dynamic = "force-dynamic";
const schema = z.object({
  email: z.string().email().max(254),
  subject: z.enum(["parser", "payment", "account", "privacy", "other"]),
  message: z.string().trim().min(20).max(2_000).refine((value) => !/(password|otp|session cookie)\s*[:=-]\s*\S+/i.test(value), "Remove passwords, OTPs or session cookies."),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    await enforceIpRateLimit(request, "contact-ip", 20, 60 * 60);
    await enforceRateLimit(request, "contact", input.email, 5, 60 * 60);
    const id = randomId("support");
    const now = new Date().toISOString();
    const priority = priorityForSubject(input.subject);
    await getD1().batch([
      getD1().prepare("INSERT INTO contact_requests (id, email, subject, message, status, category, priority, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'open', ?3, ?5, ?6, ?6)").bind(id, input.email.toLowerCase(), input.subject, input.message, priority, now),
      getD1().prepare("INSERT INTO support_request_events (id, support_request_id, actor_user_id, event_type, detail_json, created_at) VALUES (?1, ?2, NULL, 'support.created', ?3, ?4)").bind(randomId("sev"), id, JSON.stringify({ category: input.subject, priority }), now),
    ]);
    return Response.json({ reference: id, supportHours: "Business-day response target; urgent payment/account access issues are prioritized." });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid support request." }, { status: 400 });
    return Response.json({ error: "Support request could not be saved." }, { status: 503 });
  }
}
