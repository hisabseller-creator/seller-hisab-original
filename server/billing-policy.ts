export type RazorpayDisputeAction = "hold" | "restore" | "ignore";
const HOLD_EVENTS = new Set([
  "payment.dispute.created",
  "payment.dispute.under_review",
  "payment.dispute.action_required",
  "payment.dispute.lost",
  "payment.dispute.closed",
]);
export function classifyRazorpayDisputeEvent(eventType: string): RazorpayDisputeAction {
  if (eventType === "payment.dispute.won") return "restore";
  if (HOLD_EVENTS.has(eventType)) return "hold";
  return "ignore";
}
