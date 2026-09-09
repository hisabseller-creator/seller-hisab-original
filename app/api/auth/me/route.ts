import { getSessionUser } from "@/server/auth";
import { isAdminUser } from "@/server/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  return user ? Response.json({ user: { ...user, isAdmin: isAdminUser(user.email, user.phone) } }) : Response.json({ user: null });
}
