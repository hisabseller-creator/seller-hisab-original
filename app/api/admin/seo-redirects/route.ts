import { z } from "zod";
import { isPrivateSearchPath } from "@/core/seo";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { deleteSeoRedirect, listSeoRedirects, saveSeoRedirect } from "@/server/seo-redirects";

export const dynamic = "force-dynamic";

const redirectSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  fromPath: z.string().trim().startsWith("/").max(500),
  toPath: z.string().trim().startsWith("/").max(500),
  statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(308),
  active: z.boolean().default(true),
});

async function authorize(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) } as const;
  if (!isAdminUser(user.email, user.phone)) return { error: Response.json({ error: "Admin access is not enabled for this account." }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  return Response.json({ redirects: await listSeoRedirects() });
}

export async function POST(request: Request) { return save(request); }
export async function PUT(request: Request) { return save(request); }

async function save(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    const input = redirectSchema.parse(await request.json());
    if (input.fromPath === input.toPath) return Response.json({ error: "Redirect source and destination must differ." }, { status: 400 });
    if (isPrivateSearchPath(input.fromPath)) return Response.json({ error: "Private account/API routes cannot be managed as SEO redirects." }, { status: 400 });
    const id = await saveSeoRedirect(input, auth.user.id);
    return Response.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid redirect." }, { status: 400 });
    return Response.json({ error: "Redirect could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    const { id } = z.object({ id: z.string().trim().min(1).max(120) }).parse(await request.json());
    await deleteSeoRedirect(id);
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid redirect id." }, { status: 400 });
    return Response.json({ error: "Redirect could not be deleted." }, { status: 503 });
  }
}
