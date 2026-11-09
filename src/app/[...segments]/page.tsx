import { notFound, redirect } from "next/navigation";
import { PosApp } from "@/components/pos-app";
import { appPath, canAccess, defaultPathForRole, resolveAppPath } from "@/lib/app-routes";
import { getCurrentUser } from "@/lib/auth";
import { getPosBootstrap } from "@/lib/pos-service";

export const runtime = "nodejs";

export default async function AppPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const route = resolveAppPath(segments);
  if (!route) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(appPath(route))}`);
  if (!canAccess(user.role, route)) redirect(defaultPathForRole(user.role));

  const data = getPosBootstrap(user);
  if (route.section === "setup" && data.setupCompleted) redirect("/dashboard");
  if (user.role === "admin" && !data.setupCompleted && route.section !== "setup") redirect("/setup");

  return (
    <PosApp
      key={appPath(route)}
      initialData={data}
      section={route.section}
      station={route.station}
    />
  );
}
