import { getTrialOffers } from "@/server/trials";

export const dynamic = "force-dynamic";

export async function GET() {
  const offers = await getTrialOffers();
  return Response.json({
    starter: offers.starter,
    pro: offers.pro,
    autoPayRequired: true,
    note: "A free trial uses a future Razorpay subscription start date. The plan charge begins after the trial if the authorised AutoPay mandate remains active.",
  }, { headers: { "cache-control": "no-store" } });
}
