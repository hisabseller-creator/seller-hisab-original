import { z } from "zod";
import { getSessionUser } from "@/server/auth";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { getConnectedReportForUser } from "@/server/connectors/reports";

export const dynamic = "force-dynamic";

const connectorSchema = z.enum(["amazon-in-v1", "flipkart-v1", "shopify-v1", "woocommerce-v1"]);

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    await requirePaidCapability(user, "connectors");
    const connectorId = connectorSchema.parse(new URL(request.url).searchParams.get("connectorId"));
    const report = await getConnectedReportForUser(user.id, connectorId);
    if (!report) return Response.json({ error: "Connect this marketplace before opening its connected report." }, { status: 404 });
    return Response.json({ report, syncRequiresPlan: "pro" as const });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof z.ZodError) return Response.json({ error: "Choose a supported connected marketplace." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Connected report could not be loaded." }, { status: 503 });
  }
}
