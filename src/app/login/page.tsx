import { LoginScreen } from "@/components/login-screen";
import { safeNextPath } from "@/lib/app-routes";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginScreen next={safeNextPath(next)} />;
}
