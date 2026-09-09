import { BellRing, Building2, FileDown } from "lucide-react";

export type SellerHisabPaidPlan = "action_report" | "starter" | "pro";

export function PlanTierIcon({
  plan,
  className = "size-5",
}: {
  plan: SellerHisabPaidPlan;
  className?: string;
}) {
  if (plan === "action_report") return <FileDown className={className} />;
  if (plan === "starter") return <BellRing className={className} />;
  return <Building2 className={className} />;
}
