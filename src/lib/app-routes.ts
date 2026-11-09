import type { UserRole } from "@/lib/types";

export type AppSection =
  | "dashboard"
  | "kasir"
  | "kas"
  | "pesanan"
  | "menu"
  | "inventory"
  | "laporan"
  | "pengaturan"
  | "setup";

export type StationSlug = "barista" | "kitchen";

export type AppRoute = { section: AppSection; station?: StationSlug };

const sectionRoles: Record<Exclude<AppSection, "pesanan">, UserRole[]> = {
  dashboard: ["admin", "cashier"],
  kasir: ["admin", "cashier"],
  kas: ["admin", "cashier"],
  menu: ["admin"],
  inventory: ["admin"],
  laporan: ["admin", "cashier"],
  pengaturan: ["admin"],
  setup: ["admin"],
};

const stationRoles: Record<StationSlug, UserRole> = {
  barista: "barista",
  kitchen: "kitchen",
};

export function resolveAppPath(segments: string[]): AppRoute | null {
  const [first, second, ...rest] = segments;
  if (rest.length > 0) return null;
  if (first === "pesanan") {
    if (second === undefined) return { section: "pesanan" };
    if (second === "barista" || second === "kitchen") return { section: "pesanan", station: second };
    return null;
  }
  if (second !== undefined || !first) return null;
  if (first && Object.keys(sectionRoles).includes(first)) return { section: first as AppSection };
  return null;
}

export function appPath(route: AppRoute): string {
  if (route.section === "pesanan") return route.station ? `/pesanan/${route.station}` : "/pesanan";
  return `/${route.section}`;
}

export function canAccess(role: UserRole, route: AppRoute): boolean {
  if (route.section === "pesanan") {
    if (role === "admin" || role === "cashier") return true;
    return route.station !== undefined && stationRoles[route.station] === role;
  }
  return sectionRoles[route.section].includes(role);
}

export function defaultPathForRole(role: UserRole): string {
  if (role === "barista") return "/pesanan/barista";
  if (role === "kitchen") return "/pesanan/kitchen";
  return "/dashboard";
}

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  return value;
}
