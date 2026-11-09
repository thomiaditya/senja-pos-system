import { redirect } from "next/navigation";
import { defaultPathForRole } from "@/lib/app-routes";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(defaultPathForRole(user.role));
}
