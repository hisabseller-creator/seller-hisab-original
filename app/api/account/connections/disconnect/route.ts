import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";
import { disconnectOwnedConnection } from "@/server/connectors/store";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  connectorId: z.enum(["amazon-in-v1", "flipkart-v1", "shopify-v1", "woocommerce-v1"]),
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin disconnect blocked." }, { status: 403 });

  try {
    // A seller must always be able to revoke a marketplace connection, even if
    // their paid plan has expired. Pro is enforced at sync/analysis time.
    await requireWorkspaceCapability(user, "connector_manage");
    await enforceRateLimit(request, "connector-disconnect", user.id, 12, 60 * 60);
    const input = inputSchema.parse(await request.json());
    const disconnected = await disconnectOwnedConnection(user.id, input.connectorId);
    return Response.json({ disconnected });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Choose a supported connector." }, { status: 400 });
    return Response.json({ error: "Marketplace could not be disconnected." }, { status: 503 });
  }
}
