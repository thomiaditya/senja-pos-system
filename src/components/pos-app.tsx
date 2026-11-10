"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  Banknote,
  Bell,
  BellOff,
  Bluetooth,
  BluetoothConnected,
  Boxes,
  ChartNoAxesCombined,
  Check,
  Circle,
  ClipboardList,
  Clock3,
  Coffee,
  Compass,
  CreditCard,
  FileText,
  HandCoins,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  Square,
  Store,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { appPath, defaultPathForRole, type AppSection, type StationSlug } from "@/lib/app-routes";
import {
  connectBrowserPrinter,
  disconnectBrowserPrinter,
  getBrowserPrinter,
  isBrowserBluetoothSupported,
  printOverBrowserBluetooth,
  subscribeBrowserPrinter,
} from "@/lib/browser-bluetooth-printer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "cn";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CancelReasonDialog, ConfirmDialog } from "@/components/action-dialogs";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/rupiah-input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TableMap, type MapSelection, type ShapeRect } from "@/components/table-map";
import { GuidedTour, startGuidedTour } from "@/components/guided-tour";
import { TaskLauncher } from "@/components/task-launcher";
import { AssistantChat } from "@/components/assistant-chat";
import {
  enableQueueAlarmSound,
  formatQueueElapsed,
  getQueueLevel,
  isQueueAudioRunning,
  isQueueTimedStatus,
  playNewOrderChime,
  playQueueAlarmBeep,
  QUEUE_ALARM_REPEAT_MS,
  type QueueLevel,
  unlockQueueAudio,
} from "@/lib/queue-alarm";
import { PRINTER_BAUD_RATES, type PrinterSerialPort } from "@/lib/types";
import { calculateDiscountAmount, calculateOrderTotals, isDiscountEligible } from "@/lib/pricing";
import type {
  CashShift,
  CustomerSuggestion,
  Discount,
  DiningTable,
  Expense,
  ExpenseSource,
  ExpenseStatus,
  ManagedAccount,
  MapShape,
  MapShapeKind,
  Order,
  OrderItem,
  OpenTabSummary,
  PendingCancelRequest,
  PosBootstrap,
  Product,
  Receivable,
  StationTicket,
  TablePickerMode,
  TabDetail,
  UserRole,
} from "@/lib/types";

type CartItem = {
  key: string;
  productId: number;
  name: string;
  category: string;
  icon: string;
  price: number;
  modifier: string;
  quantity: number;
};
type OrderAction =
  | { action: "start" | "ready"; station: "Kitchen" | "Barista" }
  | { action: "pickup" }
  | { action: "cancel"; reason: string }
  | { action: "request_cancel"; reason: string };
type ApiResult<T> = T & { error?: string };
type NewProductInput = {
  name: string;
  category: string;
  price: number;
  station: "Kitchen" | "Barista";
  icon: string;
  note: string;
  modifiers: string[];
  recipe: { ingredientId: string; amount: number }[];
};
type NewIngredientInput = { name: string; unit: string; initialStock: number; minimum: number };
type NewDiscountInput = {
  name: string;
  kind: "Percent" | "Fixed";
  value: number;
  minSubtotal: number;
  maxAmount: number | null;
  active: boolean;
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  cashier: "Kasir",
  barista: "Barista",
  kitchen: "Kitchen",
};
const navItems: { id: AppSection; label: string; icon: LucideIcon; roles: UserRole[] }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "cashier"] },
  { id: "kasir", label: "Kasir", icon: ShoppingCart, roles: ["admin", "cashier"] },
  { id: "kas", label: "Kas", icon: Banknote, roles: ["admin", "cashier"] },
  { id: "pesanan", label: "Pesanan", icon: ClipboardList, roles: ["admin", "cashier", "barista", "kitchen"] },
  { id: "menu", label: "Menu", icon: Coffee, roles: ["admin"] },
  { id: "inventory", label: "Inventory", icon: Boxes, roles: ["admin"] },
  { id: "laporan", label: "Laporan", icon: ChartNoAxesCombined, roles: ["admin", "cashier"] },
  { id: "pengaturan", label: "Pengaturan", icon: Settings2, roles: ["admin"] },
];
const stationLabels: Record<StationSlug, "Barista" | "Kitchen"> = { barista: "Barista", kitchen: "Kitchen" };
const orderStatusStyles: Record<Order["status"], string> = {
  Queued: "border-transparent bg-amber-100 text-amber-800",
  Preparing: "border-transparent bg-blue-100 text-blue-800",
  "Ready for pickup": "border-transparent bg-emerald-100 text-emerald-800",
  Completed: "border-transparent bg-slate-100 text-slate-700",
  Cancelled: "border-transparent bg-red-100 text-red-700",
};
const orderStatusLabels: Record<Order["status"], string> = {
  Queued: "Antrean",
  Preparing: "Diproses",
  "Ready for pickup": "Siap diambil",
  Completed: "Selesai",
  Cancelled: "Dibatalkan",
};
const columns: { status: Order["status"]; label: string; tone: string }[] = [
  { status: "Queued", label: "Antrean", tone: "bg-amber-50/70" },
  { status: "Preparing", label: "Sedang diproses", tone: "bg-blue-50/70" },
  { status: "Ready for pickup", label: "Siap diambil", tone: "bg-emerald-50/70" },
  { status: "Completed", label: "Selesai", tone: "bg-slate-50" },
  { status: "Cancelled", label: "Dibatalkan", tone: "bg-red-50/70" },
];

function money(value: number) {
  return currency.format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" })
    .format(new Date(value));
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(value));
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="space-y-2">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>}
        <h1 className="text-4xl font-normal tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className={cn("flex size-9 items-center justify-center rounded-md", tone)}><Icon className="size-4" /></div>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  return <Badge className={orderStatusStyles[status]}>{orderStatusLabels[status]}</Badge>;
}

async function requestJson<T>(
  url: string,
  method: string,
  body?: unknown,
  onUnauthorized?: () => void,
): Promise<T> {
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) payload = JSON.stringify(body);
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body === undefined || body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: payload,
  });
  const result = await response.json() as ApiResult<T>;
  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error("Sesi login berakhir.");
  }
  if (!response.ok) throw new Error(result.error ?? "Permintaan tidak berhasil.");
  return result;
}

const ORDERS_POLL_MS = 4000;

export function PosApp({
  initialData,
  section,
  station,
}: {
  initialData: PosBootstrap;
  section: AppSection;
  station?: StationSlug;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const user = data.user;
  const [pending, setPending] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ order: Order; mode: "cancel" | "request" } | null>(null);
  const [approvalRequestId, setApprovalRequestId] = useState<string | null>(null);

  async function refresh() {
    const updated = await requestJson<PosBootstrap>("/api/bootstrap", "GET", undefined, () => router.replace("/login"));
    setData(updated);
    return updated;
  }

  const ordersSignature = useRef<string | null>(null);
  useEffect(() => {
    if (section !== "pesanan") return;
    let inFlight = false;
    async function syncOrders() {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { signature } = await requestJson<{ signature: string }>("/api/orders/feed", "GET", undefined, () => router.replace("/login"));
        const previous = ordersSignature.current;
        ordersSignature.current = signature;
        if (previous !== signature) {
          setData(await requestJson<PosBootstrap>("/api/bootstrap", "GET", undefined, () => router.replace("/login")));
        }
      } catch {
        // Polling is best-effort; the next tick retries.
      } finally {
        inFlight = false;
      }
    }
    void syncOrders();
    const intervalId = window.setInterval(syncOrders, ORDERS_POLL_MS);
    document.addEventListener("visibilitychange", syncOrders);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncOrders);
    };
  }, [section, router]);

  async function perform<T>(work: () => Promise<T>, successMessage: string, refreshData = true) {
    setPending(true);
    try {
      const result = await work();
      if (refreshData) await refresh();
      toast.success(successMessage);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Sesi login berakhir.") {
        router.replace("/login");
        return null;
      }
      toast.error(error instanceof Error ? error.message : "Permintaan tidak berhasil.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await perform(
      async () => requestJson("/api/auth/logout", "POST"),
      "Anda telah keluar.",
      false,
    );
    router.replace("/login");
  }

  async function orderAction(orderId: string, action: OrderAction) {
    const response = await perform(
      async () => requestJson<{ order: Order }>(`/api/orders/${orderId}/action`, "POST", action),
      action.action === "pickup"
        ? "Pickup pesanan diselesaikan."
        : action.action === "request_cancel"
          ? "Pengajuan pembatalan dikirim ke SPV."
          : "Status pesanan diperbarui.",
    );
    return response?.order ?? null;
  }

  async function decideCancelRequest(requestId: string, decision: "approve" | "reject") {
    if (decision === "approve") {
      setApprovalRequestId(requestId);
      return;
    }
    await perform(
      async () => requestJson(`/api/cancel-requests/${requestId}`, "PATCH", { action: decision }),
      "Pengajuan pembatalan ditolak.",
    );
  }

  async function approveCancelRequest(requestId: string) {
    await perform(
      async () => requestJson(`/api/cancel-requests/${requestId}`, "PATCH", { action: "approve" }),
      "Pesanan dibatalkan sesuai pengajuan kasir.",
    );
  }

  async function saveProduct(productId: number, patch: { price?: number; active?: boolean; station?: "Kitchen" | "Barista" }) {
    return perform(
      async () => requestJson(`/api/products/${productId}`, "PATCH", patch),
      "Perubahan menu tersimpan.",
    );
  }

  async function createProduct(input: NewProductInput) {
    return perform(
      async () => requestJson("/api/products", "POST", input),
      "Menu baru ditambahkan.",
    );
  }

  async function createIngredient(input: NewIngredientInput) {
    return perform(
      async () => requestJson("/api/ingredients", "POST", input),
      "Bahan baru ditambahkan.",
    );
  }

  async function adjustInventory(input: { ingredientId: string; amount: number; reason: string }) {
    return perform(
      async () => requestJson("/api/inventory", "POST", input),
      "Mutasi stok berhasil dicatat.",
    );
  }

  async function createDiscount(input: NewDiscountInput) {
    return perform(
      async () => requestJson("/api/discounts", "POST", input),
      "Diskon baru ditambahkan.",
    );
  }

  async function setDiscountActive(discountId: number, active: boolean) {
    return perform(
      async () => requestJson(`/api/discounts/${discountId}`, "PATCH", { active }),
      active ? "Diskon diaktifkan." : "Diskon dinonaktifkan.",
    );
  }

  async function removeDiscount(discountId: number) {
    return perform(
      async () => requestJson(`/api/discounts/${discountId}`, "DELETE"),
      "Diskon dihapus.",
    );
  }

  const sections = navItems.filter((item) => item.roles.includes(user.role));
  const activeLabel = navItems.find((item) => item.id === section)?.label ?? "Setup awal";
  const activeOrders = data.orders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).length;

  if (section === "setup") {
    return <SetupWizard data={data} pending={pending} runAction={perform} />;
  }

  return (
    <>
    <TooltipProvider>
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="pointer-events-none">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Coffee className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-heading text-lg">Kopi Senja</span>
                  <span className="truncate text-xs text-muted-foreground">Point of Sale</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
            <Avatar src={data.outletLogoUrl} name={data.outletName} className="size-8 shrink-0 overflow-hidden rounded-md bg-primary/10 text-xs font-semibold text-primary [&_img]:size-full [&_img]:object-cover flex items-center justify-center" />
            <div className="grid min-w-0 flex-1 text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{data.outletName}</span>
              <span className="truncate text-xs text-muted-foreground">Outlet aktif</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup data-tour="sidebar-menu">
            <SidebarGroupLabel>Menu utama</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map(({ id, label, icon: Icon }) => {
                  const isStationRole = user.role === "barista" || user.role === "kitchen";
                  const href = id === "pesanan" && isStationRole ? defaultPathForRole(user.role) : appPath({ section: id });
                  return (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        tooltip={label}
                        isActive={section === id}
                        render={<Link href={href} prefetch={false} />}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {id === "pesanan" && activeOrders > 0 && <SidebarMenuBadge>{activeOrders}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {user.role === "admin" && data.summary.lowStockCount > 0 && (
            <Alert className="mx-2 w-auto group-data-[collapsible=icon]:hidden">
              <AlertTriangle />
              <AlertTitle>Stok perlu dicek</AlertTitle>
              <AlertDescription>{data.summary.lowStockCount} bahan di batas minimum</AlertDescription>
            </Alert>
          )}
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-3 rounded-lg p-2 group-data-[collapsible=icon]:justify-center">
            <Avatar src={data.userAvatarUrl} name={user.name} className="size-8 shrink-0 overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary [&_img]:size-full [&_img]:object-cover flex items-center justify-center" />
            <div className="grid min-w-0 flex-1 text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{roleLabels[user.role]}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} disabled={pending} title="Keluar" aria-label="Keluar">
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-6 backdrop-blur md:px-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Operasional</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{activeLabel}</span>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <AssistantChat role={user.role} />
            <Button type="button" variant="outline" size="sm" onClick={() => startGuidedTour()}>
              <Compass data-icon="inline-start" />
              Panduan
            </Button>
            <span className="hidden md:inline">{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-8 px-6 py-8 md:px-10 md:py-10">
          {section === "dashboard" && <Dashboard data={data} role={user.role} onNavigate={(target) => router.push(appPath({ section: target }))} />}
          {section === "kasir" && (
            <Cashier
              data={data}
              pending={pending}
              onPrint={setPrintOrder}
              onRefresh={refresh}
            />
          )}
          {section === "pesanan" && <TaskLauncher role={user.role} />}
          {section === "pesanan" && (
            <OrdersBoard
              data={data}
              pending={pending}
              station={station}
              onAction={orderAction}
              onCancel={(order) => setCancelTarget({ order, mode: "cancel" })}
              onRequestCancel={(order) => setCancelTarget({ order, mode: "request" })}
              onDecideCancelRequest={decideCancelRequest}
              onRefreshRequests={() => perform(refresh, "Daftar pengajuan diperbarui.", false)}
              onPrint={setPrintOrder}
            />
          )}
          {section === "menu" && (
            <MenuScreen
              data={data}
              pending={pending}
              onSave={saveProduct}
              onCreate={createProduct}
              onCreateDiscount={createDiscount}
              onSetDiscountActive={setDiscountActive}
              onRemoveDiscount={removeDiscount}
            />
          )}
          {section === "kas" && <CashScreen data={data} pending={pending} runAction={perform} />}
          {section === "inventory" && (
            <InventoryScreen data={data} pending={pending} onAdjust={adjustInventory} onCreate={createIngredient} />
          )}
          {section === "laporan" && <ReportsScreen data={data} />}
          {section === "pengaturan" && (
            <SettingsScreen data={data} pending={pending} runAction={perform} />
          )}
        </main>
        </SidebarInset>
        <GuidedTour role={user.role} section={section} />
      </SidebarProvider>
      </TooltipProvider>

      <Toaster richColors position="top-right" />
      {printOrder && (
        <PrintDialog
          order={printOrder}
          data={data}
          onClose={() => setPrintOrder(null)}
        />
      )}
      {cancelTarget && (
        <CancelReasonDialog
          orderNumber={cancelTarget.order.orderNumber}
          mode={cancelTarget.mode}
          onClose={() => setCancelTarget(null)}
          onSubmit={(reason) => {
            const { order, mode } = cancelTarget;
            setCancelTarget(null);
            void orderAction(order.id, { action: mode === "request" ? "request_cancel" : "cancel", reason });
          }}
        />
      )}
      {approvalRequestId && (
        <ConfirmDialog
          title="Setujui pembatalan ini?"
          description="Pesanan akan dibatalkan sesuai pengajuan kasir. Pembayaran pesanan akan direfund otomatis."
          confirmLabel="Setujui pembatalan"
          onClose={() => setApprovalRequestId(null)}
          onConfirm={() => {
            const requestId = approvalRequestId;
            setApprovalRequestId(null);
            void approveCancelRequest(requestId);
          }}
        />
      )}
    </>
  );
}

function Dashboard({ data, role, onNavigate }: { data: PosBootstrap; role: UserRole; onNavigate: (section: AppSection) => void }) {
  const summary = data.summary;
  const maxDaily = Math.max(1, ...summary.dailySales.map((sale) => sale.total));
  const recentOrders = data.orders.slice(0, 5);
  const lowIngredients = data.ingredients
    .filter((ingredient) => ingredient.onHand - ingredient.reserved <= ingredient.minimum)
    .slice(0, 4);

  return (
    <>
      <SectionTitle
        eyebrow={`Ringkasan ${data.outletName}`}
        title="Dashboard"
        action={<Button onClick={() => onNavigate("kasir")}><Plus data-icon="inline-start" />Transaksi baru</Button>}
      />
      <div className="flex items-center justify-between gap-4 rounded-xl bg-primary p-6 text-primary-foreground">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary-foreground/80">Hari ini di {data.outletName}</p>
          <h2 className="text-xl font-semibold">Selamat bekerja, operasional berjalan lancar.</h2>
          <p className="text-base text-primary-foreground/80">Pesanan aktif dan ringkasan penjualan outlet Anda.</p>
        </div>
        <Coffee className="hidden size-14 shrink-0 text-primary-foreground/90 sm:block" strokeWidth={1.25} />
      </div>
      <TaskLauncher role={role} />
      <div className="grid gap-2 sm:grid-cols-3" data-tour="dashboard-metrics">
        <MetricCard icon={Wallet} label="Penjualan hari ini" value={money(summary.todaySales)} note={`${summary.todayOrders} transaksi terbayar`} tone="bg-blue-100 text-blue-700" />
        <MetricCard icon={ClipboardList} label="Pesanan aktif" value={String(summary.activeOrders)} note="Menunggu atau sedang dibuat" tone="bg-sky-100 text-sky-700" />
        <MetricCard icon={PackageCheck} label="Bahan perlu dicek" value={String(summary.lowStockCount)} note={summary.lowStockCount ? "Di bawah batas minimum" : "Semua stok aman"} tone="bg-amber-100 text-amber-700" />
      </div>
      <div className="grid gap-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Penjualan 7 hari</CardTitle>
            <CardDescription>Ringkasan pendapatan harian</CardDescription>
            <CardAction><Badge variant="secondary">Minggu ini</Badge></CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{money(summary.dailySales.reduce((sum, item) => sum + item.total, 0))}</p>
              <p className="text-sm text-muted-foreground">Total 7 hari terakhir</p>
            </div>
            <div className="grid h-56 grid-cols-7 gap-3" role="img" aria-label="Grafik penjualan tujuh hari terakhir">
              {summary.dailySales.map((sale) => (
                <div className="flex h-full flex-col items-center gap-2" key={sale.date}>
                  <span className="text-xs tabular-nums text-muted-foreground">{sale.total ? money(sale.total) : "—"}</span>
                  <div className="flex w-full flex-1 items-end rounded-md bg-muted p-1">
                    <div className="w-full rounded-sm bg-primary transition-all" style={{ height: `${Math.max(4, sale.total / maxDaily * 100)}%` }} />
                  </div>
                  <span className="text-sm text-muted-foreground">{sale.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Menu terlaris</CardTitle>
            <CardDescription>Paling banyak dipesan hari ini</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.topProducts.length === 0 ? <EmptyState text="Belum ada penjualan hari ini." /> : (
              <ul className="divide-y">
                {summary.topProducts.slice(0, 4).map((product, index) => (
                  <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={product.name}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold tabular-nums">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.quantity} item terjual</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Pesanan terbaru</CardTitle>
            <CardDescription>Aktivitas transaksi outlet</CardDescription>
            <CardAction>
              <Button variant="link" size="sm" onClick={() => onNavigate("pesanan")}>
                Lihat semua<ArrowRight data-icon="inline-end" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? <EmptyState text="Belum ada transaksi." /> : (
              <ul className="divide-y">
                {recentOrders.map((order) => (
                  <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={order.id}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"><ShoppingCart className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="truncate text-sm text-muted-foreground">{order.type}{order.table ? ` · ${order.table}` : ""} · {dateTime(order.createdAt)}</p>
                    </div>
                    <StatusBadge status={order.status} />
                    <span className="w-28 text-right font-semibold tabular-nums">{money(order.total ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {data.user.role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Perhatian stok</CardTitle>
              <CardDescription>Stok tersedia dibanding batas minimum</CardDescription>
            </CardHeader>
            <CardContent>
              {lowIngredients.length === 0 ? <EmptyState text="Semua bahan baku berada di batas aman." /> : (
                <ul className="divide-y">
                  {lowIngredients.map((ingredient) => (
                    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={ingredient.id}>
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{ingredient.name}</p>
                        <p className="text-sm text-muted-foreground">{ingredient.onHand - ingredient.reserved} {ingredient.unit} tersedia · minimum {ingredient.minimum}</p>
                      </div>
                      <Badge variant="outline" className="text-amber-700">Rendah</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

type PaymentMethod = "Cash" | "QRIS" | "Debit/Kredit" | "Kasbon";
type CheckoutPayment = { customerName: string; method: PaymentMethod; cashReceived: number | null };

function Cashier({
  data,
  pending,
  onPrint,
  onRefresh,
}: {
  data: PosBootstrap;
  pending: boolean;
  onPrint: (order: Order) => void;
  onRefresh: () => Promise<unknown>;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState("Semua");
  const [search, setSearch] = useState("");
  const [orderType, setOrderType] = useState<"Dine-in" | "Takeaway">("Dine-in");
  const [tableId, setTableId] = useState<number | null>(null);
  const selectedTable = data.tables.find((candidate) => candidate.id === tableId) ?? null;
  const table = selectedTable?.name ?? "";
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [discountId, setDiscountId] = useState<number | null>(null);
  const [tabOpenDialogOpen, setTabOpenDialogOpen] = useState(false);
  const [tabCloseOpen, setTabCloseOpen] = useState(false);
  const [tabSaving, setTabSaving] = useState(false);
  const selectedTab: OpenTabSummary | null = orderType === "Dine-in" ? selectedTable?.openTab ?? null : null;
  const activeDiscounts = data.discounts.filter((discount) => discount.active);
  const categories = ["Semua", ...new Set(data.products.map((product) => product.category))];
  const products = data.products.filter((product) =>
    product.active
      && product.available
      && (category === "Semua" || product.category === category)
      && product.name.toLowerCase().includes(search.toLowerCase()),
  );
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedDiscount = data.discounts.find((candidate) => candidate.id === discountId) ?? null;
  // Ineligible discounts are not applied, so the preview always matches what the server will calculate.
  const appliedDiscount = selectedDiscount && isDiscountEligible(selectedDiscount, subtotal) ? selectedDiscount : null;
  const discountAmount = appliedDiscount ? calculateDiscountAmount(appliedDiscount, subtotal) : 0;
  const { tax, total } = calculateOrderTotals(subtotal, data.taxRateBasisPoints, discountAmount);

  function addProduct(product: Product) {
    const modifier = product.modifiers[0] ?? "";
    const key = `${product.id}:${modifier}`;
    if ((cart.find((item) => item.key === key)?.quantity ?? 0) >= 50) {
      toast.error("Maksimal 50 item per pilihan menu.");
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, {
        key,
        productId: product.id,
        name: product.name,
        category: product.category,
        icon: product.icon,
        price: product.price,
        modifier,
        quantity: 1,
      }];
    });
  }

  function changeQuantity(key: string, amount: number) {
    if (amount > 0 && (cart.find((item) => item.key === key)?.quantity ?? 0) >= 50) {
      toast.error("Maksimal 50 item per pilihan menu.");
      return;
    }
    setCart((current) => current
      .map((item) => item.key === key ? { ...item, quantity: item.quantity + amount } : item)
      .filter((item) => item.quantity > 0));
  }

  function resetCart() {
    setCart([]);
    setNote("");
    setDiscountId(null);
  }

  function tabItems() {
    return cart.map((item) => ({ productId: item.productId, quantity: item.quantity, modifier: item.modifier }));
  }

  async function openTabWith(customerName: string): Promise<boolean> {
    if (!selectedTable) return false;
    setTabSaving(true);
    try {
      await requestJson<{ tab: TabDetail }>("/api/tabs", "POST", {
        idempotencyKey: crypto.randomUUID(),
        table: selectedTable.name,
        customerName,
        discountId: appliedDiscount?.id ?? null,
        note,
        items: tabItems(),
      }, () => router.replace("/login"));
      resetCart();
      toast.success(`Tab ${selectedTable.name} dibuka untuk ${customerName}.`);
      await onRefresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tab tidak berhasil dibuka.");
      return false;
    } finally {
      setTabSaving(false);
    }
  }

  async function addToTab() {
    if (!selectedTab) return;
    setTabSaving(true);
    try {
      const result = await requestJson<{ order: Order }>(`/api/tabs/${selectedTab.id}/orders`, "POST", {
        idempotencyKey: crypto.randomUUID(),
        discountId: appliedDiscount?.id ?? null,
        note,
        items: tabItems(),
      }, () => router.replace("/login"));
      resetCart();
      toast.success(`Pesanan ${result.order.orderNumber} ditambahkan ke tab ${selectedTab.customerName}.`);
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pesanan tidak berhasil ditambahkan ke tab.");
    } finally {
      setTabSaving(false);
    }
  }

  async function checkout(payment: CheckoutPayment): Promise<boolean> {
    setSaving(true);
    try {
      const result = await requestJson<{ order: Order; drawer?: { opened: boolean; warning: string | null } | null }>("/api/orders", "POST", {
          idempotencyKey: crypto.randomUUID(),
          type: orderType,
          customerName: payment.customerName,
          table: orderType === "Dine-in" ? table : null,
          paymentMethod: payment.method,
          cashReceived: payment.cashReceived,
          discountId: appliedDiscount?.id ?? null,
          note,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            modifier: item.modifier,
          })),
        }, () => router.replace("/login"));
      if (!result.order) throw new Error("Respons transaksi tidak memuat pesanan.");
      setCart([]);
      setNote("");
      setDiscountId(null);
      setOrderHistoryOpen(false);
      onPrint(result.order);
      toast.success(`Pesanan ${result.order.orderNumber} berhasil dibuat.`);
      if (result.drawer?.warning) {
        toast.warning(`Pembayaran tersimpan, tetapi laci tidak terbuka: ${result.drawer.warning}`);
      }
      try {
        await onRefresh();
      } catch {
        toast.error("Transaksi berhasil, tetapi ringkasan belum diperbarui. Muat ulang halaman untuk melihatnya.");
      }
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === "Failed to fetch") {
        toast.error("Server tidak dapat dijangkau. Periksa koneksi jaringan lokal.");
      } else {
        toast.error(error instanceof Error ? error.message : "Transaksi tidak berhasil.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle
        eyebrow="POINT OF SALE"
        title="Kasir"
        action={<Button variant="outline" onClick={() => setOrderHistoryOpen((open) => !open)}><Clock3 data-icon="inline-start" /> Riwayat hari ini</Button>}
      />
      {orderHistoryOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat transaksi terbaru</CardTitle>
            <CardDescription>Pilih cetak untuk membuka kembali nota dan tiket</CardDescription>
            <CardAction>
              <Button variant="ghost" size="icon" aria-label="Tutup riwayat" onClick={() => setOrderHistoryOpen(false)}><X /></Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {data.orders.slice(0, 8).map((order) => (
              <div className="flex items-center gap-4 py-3" key={order.id}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong className="font-semibold">{order.orderNumber}</strong>
                  <span className="text-sm text-muted-foreground">{dateTime(order.createdAt)} · {order.paymentMethod ?? "Pembayaran"}</span>
                </div>
                <StatusBadge status={order.status} />
                <strong className="font-semibold tabular-nums">{money(order.total ?? 0)}</strong>
                <Button variant="outline" size="icon" onClick={() => onPrint(order)} title="Cetak ulang" aria-label="Cetak ulang"><Printer /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari menu..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <Button key={item} size="sm" variant={category === item ? "default" : "outline"} className="rounded-full" onClick={() => setCategory(item)}>{item}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4" data-tour="cashier-menu">
            {products.map((product) => (
              <button
                className="group flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                key={product.id}
                onClick={() => addProduct(product)}
              >
                <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-2xl">{product.icon || "☕"}</span>
                {product.note && <span className="text-xs text-muted-foreground">{product.note}</span>}
                <strong className="font-semibold">{product.name}</strong>
                <span className="text-sm text-muted-foreground">{product.category}</span>
                <span className="mt-auto flex items-center justify-between gap-2 pt-2 font-semibold text-primary tabular-nums">
                  {money(product.price)}
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105"><Plus className="size-4" /></span>
                </span>
              </button>
            ))}
            {products.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                <Coffee className="size-7" />
                <strong className="font-semibold text-foreground">Menu tidak ditemukan</strong>
                <span>Coba kata kunci atau kategori lain.</span>
              </div>
            )}
          </div>
        </section>

        <Card className="sticky top-20 self-start" data-tour="cashier-cart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="size-5 text-primary" /> Pesanan baru</CardTitle>
            <CardDescription>{cart.reduce((sum, item) => sum + item.quantity, 0)} item dalam keranjang</CardDescription>
            {cart.length > 0 && (
              <CardAction>
                <Button variant="ghost" size="icon" onClick={() => setCart([])} title="Kosongkan pesanan" aria-label="Kosongkan pesanan"><Trash2 /></Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["Dine-in", "Takeaway"] as const).map((type) => (
              <Button key={type} variant={orderType === type ? "default" : "ghost"} size="sm" onClick={() => setOrderType(type)}>
                {type === "Dine-in" ? "Makan di tempat" : "Bungkus"}
              </Button>
            ))}
          </div>
          {orderType === "Dine-in" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Pilih meja</span>
                {selectedTable && <Badge>{selectedTable.name}</Badge>}
              </div>
              {data.tables.length === 0 ? (
                <Alert>
                  <AlertTitle>Belum ada meja</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2">
                    <span>
                      {data.user.role === "admin"
                        ? "Tambahkan denah meja di Pengaturan terlebih dahulu."
                        : "Minta admin menambahkan denah meja di Pengaturan."}
                    </span>
                    {data.user.role === "admin" && (
                      <Link className="font-medium text-primary underline-offset-4 hover:underline" href={appPath({ section: "pengaturan" })}>Buka Pengaturan</Link>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {data.tablePickerMode === "cards" ? (
                    <TableCardPicker tables={data.tables} selectedId={tableId} onSelect={setTableId} />
                  ) : (
                    <TableMap
                      tables={data.tables}
                      shapes={data.mapShapes}
                      selection={tableId === null ? null : { type: "table", id: tableId }}
                      mode="kasir"
                      onSelectTable={(picked) => setTableId(picked.id)}
                      className="table-map-cashier"
                    />
                  )}
                  {!selectedTable && (
                    <p className="text-sm text-muted-foreground">
                      {data.tablePickerMode === "cards" ? "Pilih salah satu meja di atas." : "Klik meja di denah untuk memilihnya."}
                    </p>
                  )}
                  {selectedTab && (
                    <p className="text-sm text-muted-foreground">Tab aktif atas nama {selectedTab.customerName}. Pesanan tambahan masuk ke tab ini.</p>
                  )}
                  {selectedTable?.occupied && !selectedTab && (
                    <p className="text-sm text-muted-foreground">Meja ini sedang terisi. Pesanan tambahan tetap bisa dibuat.</p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <ShoppingCart className="size-6" /><strong className="font-semibold text-foreground">Belum ada pesanan</strong><span>Pilih menu untuk mulai transaksi.</span>
              </div>
            ) : cart.map((item) => {
              const product = data.products.find((candidate) => candidate.id === item.productId);
              return (
                <div className="flex items-center gap-3 rounded-lg border p-3" key={item.key}>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xl">{item.icon || "☕"}</div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <strong className="truncate font-semibold">{item.name}</strong>
                    <select
                      aria-label={`Pilihan ${item.name}`}
                      value={item.modifier}
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      onChange={(event) => {
                        const newModifier = event.target.value;
                        const nextKey = `${item.productId}:${newModifier}`;
                        const existingQuantity = cart.find((row) => row.key === nextKey && row.key !== item.key)?.quantity ?? 0;
                        if (existingQuantity + item.quantity > 50) {
                          toast.error("Maksimal 50 item per pilihan menu.");
                          return;
                        }
                        setCart((current) => {
                          const existing = current.find((row) => row.key === nextKey);
                          if (existing && existing.key !== item.key) {
                            return current
                              .filter((row) => row.key !== item.key)
                              .map((row) => row.key === nextKey
                                ? { ...row, quantity: row.quantity + item.quantity }
                                : row);
                          }
                          return current.map((row) => row.key === item.key
                            ? { ...row, modifier: newModifier, key: nextKey }
                            : row);
                        });
                      }}
                    >
                      {(product?.modifiers ?? []).map((modifier) => <option key={modifier}>{modifier}</option>)}
                    </select>
                    <span className="text-sm text-muted-foreground tabular-nums">{money(item.price)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-sm" onClick={() => changeQuantity(item.key, -1)} aria-label={`Kurangi ${item.name}`}><Minus /></Button>
                    <span className="w-6 text-center font-semibold tabular-nums">{item.quantity}</span>
                    <Button variant="outline" size="icon-sm" onClick={() => changeQuantity(item.key, 1)} aria-label={`Tambah ${item.name}`}><Plus /></Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cashier-note">Catatan pesanan</Label>
              <Input id="cashier-note" placeholder="Contoh: saus dipisah" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-primary"><span>Diskon ({appliedDiscount?.name})</span><span className="tabular-nums">-{money(discountAmount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak ({(data.taxRateBasisPoints / 100).toLocaleString("id-ID")}%)</span><span className="tabular-nums">{money(tax)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
            </div>
            {orderType === "Dine-in" && selectedTable && (
              <div className="flex flex-col gap-3 rounded-lg border p-3" data-tour="cashier-tab">
                {selectedTab && (
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Tab {selectedTable.name} · {selectedTab.customerName}</span>
                      <strong className="tabular-nums">{money(selectedTab.total)}</strong>
                    </div>
                    <span className="text-muted-foreground">{selectedTab.orderCount} batch pesanan belum dibayar</span>
                  </div>
                )}
                {activeDiscounts.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Diskon pesanan ini</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={appliedDiscount === null ? "default" : "outline"}
                        className="rounded-full"
                        aria-pressed={appliedDiscount === null}
                        onClick={() => setDiscountId(null)}
                      >
                        Tanpa diskon
                      </Button>
                      {activeDiscounts.map((discount) => {
                        const eligible = isDiscountEligible(discount, subtotal);
                        return (
                          <Button
                            type="button"
                            key={discount.id}
                            size="sm"
                            variant={appliedDiscount?.id === discount.id ? "default" : "outline"}
                            className="rounded-full"
                            aria-pressed={appliedDiscount?.id === discount.id}
                            disabled={!eligible}
                            onClick={() => setDiscountId(discount.id)}
                          >
                            {discount.name} · {discount.kind === "Percent" ? `${discount.value}%` : money(discount.value)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {selectedTab ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      disabled={tabSaving || pending || cart.length === 0}
                      onClick={addToTab}
                    >
                      Tambah ke tab <Plus data-icon="inline-end" />
                    </Button>
                    {cart.length === 0 && <p className="text-xs text-muted-foreground">Pilih menu dulu untuk ditambahkan ke tab.</p>}
                    <Button variant="outline" onClick={() => setTabCloseOpen(true)} disabled={tabSaving || pending}>
                      Lihat tab & bayar
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      disabled={tabSaving || pending || saving || cart.length === 0 || selectedTable.occupied}
                      onClick={() => setTabOpenDialogOpen(true)}
                    >
                      <Receipt data-icon="inline-start" /> Buka tab meja
                    </Button>
                    {selectedTable.occupied ? (
                      <p className="text-xs text-muted-foreground">Meja sudah terisi pesanan biasa. Selesaikan dulu sebelum membuka tab.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {cart.length === 0 ? "Pilih menu dulu sebelum membuka tab." : "Tab dibayar sekali saat ditutup. Nama pelanggan wajib diisi."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {!selectedTab && (
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  data-tour="cashier-checkout"
                  disabled={saving || pending || cart.length === 0 || (orderType === "Dine-in" && !selectedTable)}
                  onClick={() => setCheckoutOpen(true)}
                >
                  Lanjut ke pembayaran <ArrowRight data-icon="inline-end" />
                </Button>
                {cart.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Pilih menu dulu untuk memulai pesanan.</p>
                ) : orderType === "Dine-in" && !selectedTable ? (
                  <p className="text-xs text-muted-foreground">Pilih meja dulu untuk pesanan dine-in.</p>
                ) : null}
              </div>
            )}
          </div>
          </CardContent>
        </Card>
      </div>
      {checkoutOpen && (
        <CheckoutDialog
          items={cart}
          orderType={orderType}
          table={table}
          subtotal={subtotal}
          discounts={data.discounts.filter((discount) => discount.active)}
          appliedDiscount={appliedDiscount}
          discountAmount={discountAmount}
          onSelectDiscount={setDiscountId}
          tax={tax}
          total={total}
          taxRateLabel={(data.taxRateBasisPoints / 100).toLocaleString("id-ID")}
          customers={data.customers}
          frequentCustomers={data.frequentCustomers}
          receivables={data.receivables}
          kasbonLimit={data.kasbonLimit}
          saving={saving}
          cashShiftOpen={data.cashShift !== null}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={async (payment) => {
            const ok = await checkout(payment);
            if (ok) setCheckoutOpen(false);
            return ok;
          }}
        />
      )}
      {tabOpenDialogOpen && selectedTable && (
        <OpenTabDialog
          tableName={selectedTable.name}
          itemCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
          total={total}
          customers={data.customers}
          saving={tabSaving}
          onClose={() => setTabOpenDialogOpen(false)}
          onSubmit={async (customerName) => {
            const ok = await openTabWith(customerName);
            return ok;
          }}
        />
      )}
      {tabCloseOpen && selectedTab && selectedTable && (
        <TabCloseDialog
          tab={selectedTab}
          tableName={selectedTable.name}
          isAdmin={data.user.role === "admin"}
          isCashier={data.user.role === "cashier"}
          receivables={data.receivables}
          kasbonLimit={data.kasbonLimit}
          cashShiftOpen={data.cashShift !== null}
          onChanged={onRefresh}
          onClose={() => setTabCloseOpen(false)}
        />
      )}
    </div>
  );
}

function OpenTabDialog({
  tableName,
  itemCount,
  total,
  customers,
  saving,
  onClose,
  onSubmit,
}: {
  tableName: string;
  itemCount: number;
  total: number;
  customers: CustomerSuggestion[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (customerName: string) => Promise<boolean>;
}) {
  const [customerName, setCustomerName] = useState("");
  const customerListId = useId();
  const trimmedCustomerName = customerName.trim();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || trimmedCustomerName === "") return;
    if (await onSubmit(trimmedCustomerName)) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open && !saving) onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Buka tab {tableName}</DialogTitle>
            <DialogDescription>{itemCount} item · {money(total)}. Tab dibayar sekali saat ditutup.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tab-customer">Nama pelanggan</Label>
            <Input
              id="tab-customer"
              list={customerListId}
              value={customerName}
              placeholder="Contoh: Budi"
              autoFocus
              aria-describedby="tab-customer-hint"
              onChange={(event) => setCustomerName(event.target.value)}
            />
            {trimmedCustomerName === "" && (
              <p id="tab-customer-hint" className="text-xs text-muted-foreground">Isi nama pelanggan dulu agar tab bisa dibuka.</p>
            )}
            <datalist id={customerListId}>
              {customers.map((customer) => <option key={customer.name} value={customer.name} />)}
            </datalist>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
            <Button type="submit" disabled={saving || trimmedCustomerName === ""}>{saving ? "Membuka..." : "Buka tab"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TabCloseDialog({
  tab,
  tableName,
  isAdmin,
  isCashier,
  receivables,
  kasbonLimit,
  cashShiftOpen,
  onChanged,
  onClose,
}: {
  tab: OpenTabSummary;
  tableName: string;
  isAdmin: boolean;
  isCashier: boolean;
  receivables: Receivable[];
  kasbonLimit: number;
  cashShiftOpen: boolean;
  onChanged: () => Promise<unknown>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TabDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [batchCancel, setBatchCancel] = useState<{ order: Order; mode: "cancel" | "request" } | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [cashInput, setCashInput] = useState("");
  const total = detail?.total ?? tab.total;
  const cashReceived = Number(cashInput || 0);
  const isCash = method === "Cash";
  const isKasbon = method === "Kasbon";
  const cashShort = isCash && cashReceived < total;
  const cashBlocked = isCash && !cashShiftOpen;
  // Same kasbon rule as CheckoutDialog and the server: outstanding kasbon plus this tab must not exceed the limit.
  const customerOutstanding = receivables
    .filter((receivable) => receivable.customerName.toLowerCase() === tab.customerName.toLowerCase())
    .reduce((sum, receivable) => sum + receivable.outstanding, 0);
  const kasbonProjected = customerOutstanding + total;
  const kasbonOverLimit = isKasbon && kasbonProjected > kasbonLimit;
  const canClose = detail !== null && !busy && !cashShort && !cashBlocked && !kasbonOverLimit;

  useEffect(() => {
    let cancelled = false;
    requestJson<{ tab: TabDetail }>(`/api/tabs/${tab.id}`, "GET", undefined, () => router.replace("/login"))
      .then((result) => {
        if (cancelled) return;
        setDetail(result.tab);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Tab tidak bisa dimuat.");
      });
    return () => {
      cancelled = true;
    };
  }, [tab.id, tab.total, tab.orderCount, reloadKey, router]);

  async function cancelBatch(order: Order, reason: string) {
    setBusy(true);
    try {
      await requestJson(`/api/orders/${order.id}/action`, "POST", { action: "cancel", reason }, () => router.replace("/login"));
      toast.success(`${order.orderNumber} dibatalkan.`);
      setReloadKey((key) => key + 1);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Batch tidak berhasil dibatalkan.");
    } finally {
      setBusy(false);
    }
  }

  async function requestBatchCancel(order: Order, reason: string) {
    setBusy(true);
    try {
      await requestJson(`/api/orders/${order.id}/action`, "POST", { action: "request_cancel", reason }, () => router.replace("/login"));
      toast.success(`Pengajuan pembatalan ${order.orderNumber} dikirim ke SPV.`);
      setReloadKey((key) => key + 1);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pengajuan pembatalan tidak berhasil dikirim.");
    } finally {
      setBusy(false);
    }
  }

  async function closeTab() {
    if (!canClose) return;
    setBusy(true);
    try {
      const result = await requestJson<{ drawer?: { opened: boolean; warning: string | null } | null }>(
        `/api/tabs/${tab.id}/close`,
        "POST",
        { paymentMethod: method, cashReceived: isCash ? cashReceived : null },
        () => router.replace("/login"),
      );
      if (result.drawer?.warning) {
        toast.warning(`Tab ditutup, tetapi laci tidak terbuka: ${result.drawer.warning}`);
      } else {
        toast.success(isKasbon ? `Tab ${tableName} dicatat sebagai kasbon ${tab.customerName}.` : `Tab ${tableName} ditutup dan dibayar.`);
      }
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tab tidak berhasil ditutup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open && !busy) onClose();
    }}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="flex-row items-center justify-between gap-4 border-b p-5">
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="text-lg">Tab {tableName} · {tab.customerName}</DialogTitle>
              <DialogDescription>{tab.orderCount} batch · dibuka {dateTime(tab.openedAt)}</DialogDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={busy} aria-label="Tutup"><X /></Button>
          </DialogHeader>
          <div className="grid min-h-0 gap-5 overflow-y-auto p-5 sm:grid-cols-2">
            <div className="flex min-h-0 flex-col gap-3">
              <span className="text-sm font-medium">Batch pesanan</span>
              {loadError && <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>}
              {!detail && !loadError && <p className="text-sm text-muted-foreground">Memuat tab...</p>}
              {detail?.orders.length === 0 && <p className="text-sm text-muted-foreground">Belum ada batch pesanan.</p>}
              {detail?.orders.map((order) => {
                const cancelled = order.status === "Cancelled";
                return (
                  <div key={order.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", cancelled && "opacity-60")}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{order.orderNumber} · {dateTime(order.createdAt)}</span>
                      <Badge variant={cancelled ? "secondary" : "outline"}>{cancelled ? "Dibatalkan" : order.status}</Badge>
                    </div>
                    <ul className="flex flex-col gap-1 text-sm">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between gap-2">
                          <span>{item.quantity}× {item.name}{item.modifier ? ` (${item.modifier})` : ""}</span>
                          <span className="tabular-nums text-muted-foreground">{money(item.unitPrice * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    {isAdmin && !cancelled && (
                      <Button type="button" variant="ghost" size="sm" className="self-start text-destructive" disabled={busy} onClick={() => setBatchCancel({ order, mode: "cancel" })}>
                        Batalkan batch
                      </Button>
                    )}
                    {isCashier && !cancelled && order.status !== "Completed" && !order.cancelRequest && (
                      <Button type="button" variant="ghost" size="sm" className="self-start text-red-600" disabled={busy} onClick={() => setBatchCancel({ order, mode: "request" })}>
                        Ajukan pembatalan ke SPV
                      </Button>
                    )}
                    {order.cancelRequest && !cancelled && (
                      <span className="text-sm text-amber-700">Menunggu persetujuan SPV</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <span>Total tab</span>
                <strong className="text-lg tabular-nums">{money(total)}</strong>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      type="button"
                      key={option.method}
                      variant={method === option.method ? "default" : "outline"}
                      aria-pressed={method === option.method}
                      className="h-auto justify-start gap-2 py-2.5"
                      onClick={() => setMethod(option.method)}
                    >
                      <Icon />
                      {option.method}
                    </Button>
                  );
                })}
              </div>
              {isCash && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tab-cash">Uang diterima</Label>
                  <RupiahInput
                    id="tab-cash"
                    className="h-12 text-lg tabular-nums"
                    placeholder="Masukkan nominal"
                    value={cashInput}
                    onValueChange={setCashInput}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setCashInput(String(total))}>Uang pas</Button>
                    {CASH_QUICK_AMOUNTS.map((amount) => (
                      <Button key={amount} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setCashInput(String(amount))}>{money(amount)}</Button>
                    ))}
                  </div>
                  {cashShort && cashInput !== "" && <p className="text-sm font-medium text-destructive">Uang kurang {money(total - cashReceived)}</p>}
                  {!cashShort && (
                    <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3 text-primary">
                      <span>Kembalian</span>
                      <strong className="tabular-nums">{money(cashReceived - total)}</strong>
                    </div>
                  )}
                </div>
              )}
              {isKasbon && (
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Piutang setelah tutup tab</span><strong className="tabular-nums">{money(kasbonProjected)}</strong></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Batas kasbon</span><span className="tabular-nums">{money(kasbonLimit)}</span></div>
                  {kasbonOverLimit && <Alert variant="destructive"><AlertDescription>Kasbon melewati batas. Lunasi kasbon lama dulu atau pilih metode lain.</AlertDescription></Alert>}
                </div>
              )}
              {cashBlocked && <Alert variant="destructive"><AlertDescription>Shift kas belum dibuka. Buka shift untuk menerima pembayaran tunai.</AlertDescription></Alert>}
              <DialogFooter className="m-0 border-t-0 p-0">
                <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Tutup</Button>
                <Button type="button" disabled={!canClose} onClick={closeTab}>
                  {busy ? "Memproses..." : "Tutup tab & bayar"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
      {batchCancel && (
        <CancelReasonDialog
          orderNumber={batchCancel.order.orderNumber}
          mode={batchCancel.mode}
          onClose={() => setBatchCancel(null)}
          onSubmit={(reason) => {
            const { order, mode } = batchCancel;
            setBatchCancel(null);
            void (mode === "request" ? requestBatchCancel(order, reason) : cancelBatch(order, reason));
          }}
        />
      )}
    </Dialog>
  );
}

const PAYMENT_OPTIONS: { method: PaymentMethod; icon: typeof Wallet; hint: string }[] = [
  { method: "Cash", icon: Wallet, hint: "Terima uang tunai dan hitung kembalian" },
  { method: "QRIS", icon: QrCode, hint: "Pelanggan memindai QRIS di layar terminal" },
  { method: "Debit/Kredit", icon: CreditCard, hint: "Pembayaran kartu lewat mesin EDC" },
  { method: "Kasbon", icon: HandCoins, hint: "Bayar nanti. Dicatat sebagai piutang pelanggan" },
];
const CASH_QUICK_AMOUNTS = [20_000, 50_000, 100_000];
const CHECKOUT_STEP_LABELS = ["Pelanggan", "Diskon", "Metode", "Pembayaran", "Konfirmasi"];

function CheckoutDialog({
  items,
  orderType,
  table,
  subtotal,
  discounts,
  appliedDiscount,
  discountAmount,
  onSelectDiscount,
  tax,
  total,
  taxRateLabel,
  customers,
  frequentCustomers,
  receivables,
  kasbonLimit,
  saving,
  cashShiftOpen,
  onClose,
  onSubmit,
}: {
  items: CartItem[];
  orderType: "Dine-in" | "Takeaway";
  table: string;
  subtotal: number;
  discounts: Discount[];
  appliedDiscount: Discount | null;
  discountAmount: number;
  onSelectDiscount: (discountId: number | null) => void;
  tax: number;
  total: number;
  taxRateLabel: string;
  customers: CustomerSuggestion[];
  frequentCustomers: CustomerSuggestion[];
  receivables: Receivable[];
  kasbonLimit: number;
  saving: boolean;
  cashShiftOpen: boolean;
  onClose: () => void;
  onSubmit: (payment: CheckoutPayment) => Promise<boolean>;
}) {
  const [step, setStep] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const customerListId = useId();
  const trimmedCustomerName = customerName.trim();
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [cashInput, setCashInput] = useState("");
  const cashReceived = Number(cashInput || 0);
  const isCash = method === "Cash";
  const isKasbon = method === "Kasbon";
  const cashShort = isCash && cashReceived < total;
  const cashBlocked = isCash && !cashShiftOpen;
  // Mirrors the server rule in createPaidOrder: outstanding kasbon plus this order must not exceed the limit.
  const customerOutstanding = trimmedCustomerName === ""
    ? 0
    : receivables
      .filter((receivable) => receivable.customerName.toLowerCase() === trimmedCustomerName.toLowerCase())
      .reduce((sum, receivable) => sum + receivable.outstanding, 0);
  const kasbonProjected = customerOutstanding + total;
  const kasbonOverLimit = isKasbon && kasbonProjected > kasbonLimit;
  const canContinue = !(step === 0 && trimmedCustomerName === "")
    && !(step === 3 && (cashShort || cashBlocked || kasbonOverLimit));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isLastStep = step === CHECKOUT_STEP_LABELS.length - 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || (isLastStep && (cashBlocked || kasbonOverLimit))) return;
    if (!isLastStep) {
      if (canContinue) setStep(step + 1);
      return;
    }
    await onSubmit({ customerName: trimmedCustomerName, method, cashReceived: isCash ? cashReceived : null });
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open && !saving) onClose();
    }}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <form className="flex max-h-[90vh] flex-col" onSubmit={handleSubmit}>
          <DialogHeader className="flex-row items-center justify-between gap-4 border-b p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wallet className="size-5" /></div>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="text-lg">Pembayaran</DialogTitle>
                <DialogDescription>{itemCount} item · {orderType === "Dine-in" ? table : "Bungkus"}</DialogDescription>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Tutup"><X /></Button>
          </DialogHeader>
          <ol className="flex flex-wrap gap-2 border-b bg-muted/40 px-5 py-3 text-sm" aria-label="Langkah pembayaran">
            {CHECKOUT_STEP_LABELS.map((label, index) => (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-muted-foreground",
                  index === step && "bg-primary text-primary-foreground",
                  index < step && "text-primary",
                )}
                aria-current={index === step ? "step" : undefined}
              >
                <span className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-xs font-semibold",
                  index === step && "border-transparent bg-primary-foreground text-primary",
                  index < step && "border-primary bg-primary text-primary-foreground",
                )}>
                  {index < step ? <Check className="size-3" /> : index + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <div className="flex min-h-64 flex-col gap-4 overflow-y-auto p-5">
          {step === 0 && (
            <>
              <h3 className="text-lg font-semibold">Nama pelanggan</h3>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="checkout-customer">Nama pelanggan</Label>
                <Input
                  id="checkout-customer"
                  list={customerListId}
                  placeholder="Ketik atau pilih nama pelanggan"
                  maxLength={60}
                  autoComplete="off"
                  autoFocus
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>
              <datalist id={customerListId}>
                {customers.map((customer) => (
                  <option key={customer.name} value={customer.name} label={`${customer.orderCount}× pesan`} />
                ))}
              </datalist>
              {frequentCustomers.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground">Pelanggan yang sering memesan</p>
                  <div className="flex flex-wrap gap-2">
                    {frequentCustomers.map((customer) => (
                      <Button
                        type="button"
                        key={customer.name}
                        size="sm"
                        variant={trimmedCustomerName === customer.name ? "default" : "outline"}
                        className="rounded-full"
                        aria-pressed={trimmedCustomerName === customer.name}
                        onClick={() => setCustomerName(customer.name)}
                      >
                        {customer.name} · {customer.orderCount}×
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {trimmedCustomerName === "" && <p className="text-sm text-muted-foreground">Nama pelanggan wajib diisi sebelum lanjut.</p>}
            </>
          )}
          {step === 1 && (
            <>
              <h3 className="text-lg font-semibold">Pilih diskon</h3>
              <p className="text-sm text-muted-foreground">Diskon diterapkan sebelum pajak. Kosongkan jika tidak ada diskon.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={appliedDiscount === null ? "default" : "outline"}
                  className="rounded-full"
                  aria-pressed={appliedDiscount === null}
                  onClick={() => onSelectDiscount(null)}
                >
                  Tanpa diskon
                </Button>
                {discounts.map((discount) => {
                  const eligible = subtotal >= discount.minSubtotal;
                  const isActive = appliedDiscount?.id === discount.id;
                  return (
                    <Button
                      type="button"
                      key={discount.id}
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className="rounded-full"
                      aria-pressed={isActive}
                      disabled={!eligible}
                      onClick={() => onSelectDiscount(discount.id)}
                    >
                      {discount.name} · {discount.kind === "Percent" ? `${discount.value}%` : money(discount.value)}
                      {!eligible && <span>(min. {money(discount.minSubtotal)})</span>}
                    </Button>
                  );
                })}
              </div>
              {discounts.length === 0 && <p className="text-sm text-muted-foreground">Belum ada diskon aktif. Admin dapat menambahkannya di menu Menu.</p>}
              {appliedDiscount && (
                <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3 text-primary"><span>Potongan {appliedDiscount.name}</span><strong className="tabular-nums">-{money(discountAmount)}</strong></div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="text-lg font-semibold">Pilih metode pembayaran</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map(({ method: option, icon: Icon, hint }) => (
                  <button
                    type="button"
                    key={option}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:border-primary",
                      method === option && "border-primary bg-primary/5 ring-3 ring-primary/20",
                    )}
                    aria-pressed={method === option}
                    onClick={() => setMethod(option)}
                  >
                    <Icon className="size-6 text-primary" />
                    <strong className="font-semibold">{option}</strong>
                    <span className="text-sm text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h3 className="text-lg font-semibold">{isCash ? "Uang diterima" : isKasbon ? "Kasbon pelanggan" : `Pembayaran ${method}`}</h3>
              <div className="flex items-center justify-between rounded-lg bg-muted p-4"><span className="text-muted-foreground">Total tagihan</span><strong className="text-2xl tabular-nums">{money(total)}</strong></div>
              {cashBlocked && <Alert variant="destructive"><AlertDescription>Shift kas belum dibuka. Buka shift di menu Kas, atau pilih metode non-tunai.</AlertDescription></Alert>}
              {isKasbon ? (
                <>
                  <div className="grid gap-2 rounded-lg border p-4 text-sm">
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Piutang {trimmedCustomerName} saat ini</span><span className="tabular-nums">{money(customerOutstanding)}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Batas kasbon</span><span className="tabular-nums">{money(kasbonLimit)}</span></div>
                    <div className="flex justify-between gap-2 font-semibold"><span>Setelah pesanan ini</span><span className="tabular-nums">{money(kasbonProjected)}</span></div>
                  </div>
                  {kasbonOverLimit ? (
                    <Alert variant="destructive"><AlertDescription>Melebihi batas kasbon. Pelanggan harus melunasi sebagian piutang dulu, atau pilih metode lain.</AlertDescription></Alert>
                  ) : (
                    <p className="text-sm text-muted-foreground">Pesanan dicatat sebagai piutang dan dibayar nanti dari menu Kas.</p>
                  )}
                </>
              ) : isCash ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="checkout-cash">Nominal uang tunai</Label>
                    <RupiahInput
                      id="checkout-cash"
                      className="h-12 text-lg tabular-nums"
                      placeholder="Masukkan nominal"
                      autoFocus
                      value={cashInput}
                      onValueChange={setCashInput}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setCashInput(String(total))}>Uang pas</Button>
                    {CASH_QUICK_AMOUNTS.map((amount) => (
                      <Button type="button" key={amount} size="sm" variant="outline" className="rounded-full" onClick={() => setCashInput(String(amount))}>{money(amount)}</Button>
                    ))}
                  </div>
                  {cashShort && cashInput !== "" && <p className="text-sm font-medium text-destructive">Uang kurang {money(total - cashReceived)}</p>}
                  {!cashShort && <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3 text-primary"><span>Kembalian</span><strong className="tabular-nums">{money(cashReceived - total)}</strong></div>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {method === "QRIS"
                    ? "Minta pelanggan memindai QRIS di layar terminal, lalu pastikan pembayaran berhasil sebelum lanjut."
                    : "Minta pelanggan menyelesaikan pembayaran di mesin EDC, lalu pastikan transaksi berhasil sebelum lanjut."}
                </p>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <h3 className="text-lg font-semibold">Konfirmasi pesanan</h3>
              <div className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Pelanggan</span><strong className="font-semibold">{trimmedCustomerName}</strong></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Tipe</span><strong className="font-semibold">{orderType === "Dine-in" ? "Makan di tempat" : "Bungkus"}</strong></div>
                {orderType === "Dine-in" && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Meja</span><strong className="font-semibold">{table}</strong></div>}
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Metode</span><strong className="font-semibold">{isKasbon ? "Kasbon (belum lunas)" : method}</strong></div>
                {isKasbon && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Dibayar sekarang</span><strong className="font-semibold tabular-nums">{money(0)}</strong></div>}
                {isCash && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Uang diterima</span><strong className="font-semibold tabular-nums">{money(cashReceived)}</strong></div>}
                {isCash && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Kembalian</span><strong className="font-semibold tabular-nums">{money(cashReceived - total)}</strong></div>}
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {items.map((item) => (
                  <div className="flex justify-between gap-2" key={item.key}>
                    <span>{item.quantity}× {item.name}{item.modifier ? ` (${item.modifier})` : ""}</span>
                    <strong className="font-semibold tabular-nums">{money(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
                {appliedDiscount && <div className="flex justify-between text-primary"><span>Diskon ({appliedDiscount.name})</span><span className="tabular-nums">-{money(discountAmount)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Pajak ({taxRateLabel}%)</span><span className="tabular-nums">{money(tax)}</span></div>
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Check className="size-4" /> Pembayaran simulasi · reservasi stok otomatis</p>
            </>
          )}
          </div>
          <DialogFooter className="m-0 border-t p-4">
            {step === 0 ? (
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>Kembali</Button>
            )}
            {isLastStep ? (
              <Button type="submit" disabled={saving || cashBlocked || kasbonOverLimit}>
                {saving ? "Memproses pembayaran..." : isKasbon ? "Simpan sebagai kasbon" : "Bayar & buat pesanan"} <Check data-icon="inline-end" />
              </Button>
            ) : (
              <Button type="submit" disabled={!canContinue}>Lanjut <ArrowRight data-icon="inline-end" /></Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrdersBoard({
  data,
  pending,
  station,
  onAction,
  onCancel,
  onRequestCancel,
  onDecideCancelRequest,
  onRefreshRequests,
  onPrint,
}: {
  data: PosBootstrap;
  pending: boolean;
  station?: StationSlug;
  onAction: (id: string, action: OrderAction) => Promise<Order | null>;
  onCancel: (order: Order) => void;
  onRequestCancel: (order: Order) => void;
  onDecideCancelRequest: (requestId: string, decision: "approve" | "reject") => Promise<void>;
  onRefreshRequests: () => void;
  onPrint: (order: Order) => void;
}) {
  const stationRole = data.user.role === "barista" ? "Barista" : data.user.role === "kitchen" ? "Kitchen" : null;
  const filter: "Semua" | "Kitchen" | "Barista" = stationRole ?? (station ? stationLabels[station] : "Semua");
  const visibleOrders = useMemo(
    () => data.orders.filter((order) => filter === "Semua" || order.tickets.some((ticket) => ticket.station === filter)),
    [data.orders, filter],
  );
  const canPrint = data.user.role === "admin" || data.user.role === "cashier";
  const canPickup = canPrint;
  const canCancel = data.user.role === "admin";
  const canRequestCancel = data.user.role === "cashier";
  const boardTone = filter === "Barista" ? "station-board-barista" : filter === "Kitchen" ? "station-board-kitchen" : "";
  const hasTimedOrders = visibleOrders.some((order) => isQueueTimedStatus(order.status));
  const now = useQueueClock(hasTimedOrders);
  const hasAlarm = now !== null && visibleOrders.some((order) =>
    isQueueTimedStatus(order.status) && getQueueLevel(order.createdAt, now) === "alarm");
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (isQueueAudioRunning()) return;
    async function unlock() {
      if (!(await unlockQueueAudio())) return;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!hasAlarm || !soundEnabled) return;
    playQueueAlarmBeep();
    const intervalId = window.setInterval(playQueueAlarmBeep, QUEUE_ALARM_REPEAT_MS);
    return () => window.clearInterval(intervalId);
  }, [hasAlarm, soundEnabled]);

  async function toggleAlarmSound() {
    if (soundEnabled && isQueueAudioRunning()) {
      setSoundEnabled(false);
      return;
    }
    if (await enableQueueAlarmSound()) {
      setSoundEnabled(true);
    } else {
      toast.error("Browser belum mengizinkan suara. Klik tombol suara pesanan sekali lagi.");
    }
  }

  const seenOrderIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const previousIds = seenOrderIds.current;
    seenOrderIds.current = new Set(visibleOrders.map((order) => order.id));
    if (previousIds === null) return;
    const newOrders = visibleOrders.filter((order) => !previousIds.has(order.id));
    if (newOrders.length === 0) return;
    toast.info(`Pesanan baru masuk: ${newOrders.map((order) => order.orderNumber).join(", ")}`);
    if (soundEnabled) playNewOrderChime();
  }, [visibleOrders, soundEnabled]);
  const stationTabs: { label: string; value: "Semua" | "Kitchen" | "Barista"; href: string }[] = [
    { label: "Semua", value: "Semua", href: "/pesanan" },
    { label: "Barista", value: "Barista", href: "/pesanan/barista" },
    { label: "Kitchen", value: "Kitchen", href: "/pesanan/kitchen" },
  ];

  return (
    <div className={`flex flex-col gap-6 ${boardTone}`}>
      <SectionTitle
        eyebrow="PRODUKSI & PICKUP"
        title={filter === "Semua" ? "Pesanan" : `Pesanan ${filter}`}
        action={!stationRole && <div className="flex gap-1 rounded-lg bg-muted p-1">
          {stationTabs.map((tab) => (
            <Link
              key={tab.value}
              href={tab.href}
              prefetch={false}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                filter === tab.value && "bg-background text-foreground shadow-xs",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
        <div className="flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-emerald-500" /><strong className="font-semibold">{data.summary.activeOrders}</strong> pesanan aktif di outlet</div>
        <span className="text-muted-foreground">Link ini khusus untuk {filter === "Semua" ? "semua stasiun" : `stasiun ${filter}`} · perubahan status tersimpan otomatis</span>
        <Button
          type="button"
          variant={soundEnabled ? "default" : "outline"}
          size="sm"
          aria-pressed={soundEnabled}
          onClick={toggleAlarmSound}
        >
          {soundEnabled ? <Bell /> : <BellOff />}
          {soundEnabled ? "Suara pesanan aktif" : "Aktifkan suara pesanan"}
        </Button>
      </div>
      {hasAlarm && !soundEnabled && (
        <Alert variant="destructive" role="alert">
          <AlertTriangle />
          <AlertDescription>Ada pesanan yang menunggu lebih dari 10 menit. Aktifkan suara alarm agar peringatan berbunyi.</AlertDescription>
        </Alert>
      )}
      {data.user.role === "admin" && (
        <CancelRequestQueue
          requests={data.cancelRequests}
          pending={pending}
          onDecide={onDecideCancelRequest}
          onRefresh={onRefreshRequests}
        />
      )}
      <div className="grid gap-2 xl:grid-cols-5" data-tour="orders-board">
        {columns.map((column) => {
          const columnOrders = visibleOrders.filter((order) => order.status === column.status);
          return (
            <section className={cn("flex min-h-72 flex-col gap-2 rounded-xl border p-4", column.tone)} key={column.status}>
              <div className="flex items-center justify-between gap-2 px-1">
                <h2 className="flex items-center gap-2 text-base font-semibold"><span className="size-2 rounded-full bg-primary" />{column.label}</h2>
                <Badge variant="secondary" className="tabular-nums">{columnOrders.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {columnOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    filter={filter}
                    pending={pending}
                    canPickup={canPickup}
                    canPrint={canPrint}
                    canCancel={canCancel}
                    canRequestCancel={canRequestCancel}
                    now={now}
                    onAction={onAction}
                    onCancel={onCancel}
                    onRequestCancel={onRequestCancel}
                    onPrint={onPrint}
                  />
                ))}
                {columnOrders.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada pesanan</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CancelRequestQueue({
  requests,
  pending,
  onDecide,
  onRefresh,
}: {
  requests: PendingCancelRequest[];
  pending: boolean;
  onDecide: (requestId: string, decision: "approve" | "reject") => Promise<void>;
  onRefresh: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Pengajuan pembatalan dari kasir">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="size-4" /> Pengajuan pembatalan dari kasir
          <Badge variant="secondary" className="tabular-nums">{requests.length}</Badge>
        </h2>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onRefresh}>Muat ulang</Button>
      </div>
      {requests.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pengajuan yang menunggu.</p>}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {requests.map((request) => (
          <article key={request.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong className="font-semibold">{request.orderNumber}</strong>
              <span className="tabular-nums">{money(request.total)}</span>
            </div>
            <span className="text-muted-foreground">
              {request.orderType === "Dine-in" ? "Dine-in" : "Takeaway"}
              {request.table ? ` · ${request.table}` : ""}
              {request.customerName ? ` · ${request.customerName}` : ""}
            </span>
            <span>Alasan: {request.reason}</span>
            <span className="text-xs text-muted-foreground">Diajukan {request.requestedByName} · {dateTime(request.requestedAt)}</span>
            <div className="mt-auto flex gap-2 pt-1">
              <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => onDecide(request.id, "approve")}>Setujui pembatalan</Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onDecide(request.id, "reject")}>Tolak</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function useQueueClock(enabled: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [enabled]);
  return now;
}

function OrderCard({
  order,
  filter,
  pending,
  canPickup,
  canPrint,
  canCancel,
  canRequestCancel,
  now,
  onAction,
  onCancel,
  onRequestCancel,
  onPrint,
}: {
  order: Order;
  filter: "Semua" | "Kitchen" | "Barista";
  pending: boolean;
  canPickup: boolean;
  canPrint: boolean;
  canCancel: boolean;
  canRequestCancel: boolean;
  now: number | null;
  onAction: (id: string, action: OrderAction) => Promise<Order | null>;
  onCancel: (order: Order) => void;
  onRequestCancel: (order: Order) => void;
  onPrint: (order: Order) => void;
}) {
  const tickets = order.tickets.filter((ticket) => filter === "Semua" || ticket.station === filter);
  const timed = isQueueTimedStatus(order.status);
  const level: QueueLevel = timed && now !== null ? getQueueLevel(order.createdAt, now) : "normal";
  const levelClass = level === "alarm" ? " order-card-alarm" : level === "warning" ? " order-card-warning" : "";
  return (
    <article className={cn("order-card flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs", levelClass)}>
      <div className="order-card-top flex flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <strong className="text-sm font-semibold">{order.orderNumber}</strong>
          {order.customerName && <b className="order-customer font-semibold">{order.customerName}</b>}
          <span className="text-sm text-muted-foreground">{dateTime(order.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={order.status} />
          {timed && (
            <span className="queue-timer inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-sm font-semibold tabular-nums text-foreground" aria-label="Lama menunggu">
              <Clock3 className="size-3.5" /> {now === null ? "--:--" : formatQueueElapsed(order.createdAt, now)}
            </span>
          )}
        </div>
      </div>
      <div className="order-card-meta flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{order.type === "Dine-in" ? "Dine-in" : "Takeaway"}{order.table ? ` · ${order.table}` : ""}</span>
        {canPrint && (
          <Button variant="outline" size="icon-sm" className="text-foreground" title="Cetak nota dan tiket" aria-label="Cetak nota dan tiket" onClick={() => onPrint(order)}><Printer /></Button>
        )}
      </div>
      {order.note && <div className="flex items-start gap-1.5 rounded-md bg-muted p-2 text-sm text-foreground"><FileText className="mt-0.5 size-3.5 shrink-0" /> {order.note}</div>}
      <div className="flex flex-col gap-2">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} order={order} ticket={ticket} pending={pending} onAction={onAction} />
        ))}
      </div>
      {order.status === "Ready for pickup" && canPickup && (
        <Button disabled={pending} onClick={() => onAction(order.id, { action: "pickup" })}>
          <Check data-icon="inline-start" /> Selesaikan pickup
        </Button>
      )}
      {canRequestCancel && !["Completed", "Cancelled"].includes(order.status) && !order.cancelRequest && (
        <Button variant="outline" size="sm" onClick={() => onRequestCancel(order)}>Ajukan pembatalan ke SPV</Button>
      )}
      {order.cancelRequest && !["Completed", "Cancelled"].includes(order.status) && (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-sm text-amber-800">
          <Clock3 className="mt-0.5 size-3.5 shrink-0" /> Menunggu persetujuan SPV · {order.cancelRequest.reason}
        </div>
      )}
      {canCancel && !["Completed", "Cancelled"].includes(order.status) && (
        <Button variant="destructive" size="sm" onClick={() => onCancel(order)}>Batalkan pesanan</Button>
      )}
      {order.status === "Cancelled" && order.cancelReason && <div className="cancel-reason text-sm text-destructive">Alasan: {order.cancelReason}</div>}
      {order.status === "Completed" && <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Check className="size-3.5" /> Diambil pelanggan {order.collectedAt && dateTime(order.collectedAt)}</div>}
    </article>
  );
}

function TicketCard({
  order,
  ticket,
  pending,
  onAction,
}: {
  order: Order;
  ticket: StationTicket;
  pending: boolean;
  onAction: (id: string, action: OrderAction) => Promise<Order | null>;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-background p-4 text-foreground">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-base">{ticket.station === "Kitchen" ? "🍳" : "☕"}</span>
        <strong className="font-semibold">{ticket.station}</strong>
        <Badge variant="outline" className="ml-auto shrink-0">
          {ticket.status === "Queued" ? "Antrean" : ticket.status === "Preparing" ? "Diproses" : ticket.status === "Ready" ? "Siap" : "Batal"}
        </Badge>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {ticket.items.map((item) => (
          <div className="flex flex-col" key={item.id}>
            <span><b className="font-semibold">{item.quantity}×</b> {item.name}</span>
            {item.modifier && <small className="text-muted-foreground">{item.modifier}</small>}
          </div>
        ))}
      </div>
      {ticket.status === "Queued" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => onAction(order.id, { action: "start", station: ticket.station })}
        >
          Mulai produksi <ArrowRight data-icon="inline-end" />
        </Button>
      )}
      {ticket.status === "Preparing" && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => onAction(order.id, { action: "ready", station: ticket.station })}
        >
          <Check data-icon="inline-start" /> Tandai siap
        </Button>
      )}
    </div>
  );
}

function MenuScreen({
  data,
  pending,
  onSave,
  onCreate,
  onCreateDiscount,
  onSetDiscountActive,
  onRemoveDiscount,
}: {
  data: PosBootstrap;
  pending: boolean;
  onSave: (id: number, patch: { price?: number; active?: boolean; station?: "Kitchen" | "Barista" }) => Promise<unknown>;
  onCreate: (input: NewProductInput) => Promise<unknown>;
  onCreateDiscount: (input: NewDiscountInput) => Promise<unknown>;
  onSetDiscountActive: (discountId: number, active: boolean) => Promise<unknown>;
  onRemoveDiscount: (discountId: number) => Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const filtered = data.products.filter((product) =>
    product.name.toLowerCase().includes(query.toLowerCase())
    || product.category.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle eyebrow="Katalog & harga" title="Menu" action={<Badge variant="secondary">{data.products.length} menu terdaftar</Badge>} />
      <Card>
        <CardHeader>
          <CardTitle>Tambah menu baru</CardTitle>
          <CardDescription>Menu langsung tersedia di kasir. Setiap menu wajib punya resep bahan.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm data={data} pending={pending} onCreate={onCreate} />
        </CardContent>
      </Card>
      <DiscountManager
        discounts={data.discounts}
        pending={pending}
        onCreate={onCreateDiscount}
        onSetActive={onSetDiscountActive}
        onRemove={onRemoveDiscount}
      />
      <Card data-tour="menu-catalog">
        <CardHeader>
          <CardTitle>Katalog menu</CardTitle>
          <CardDescription>Perubahan harga dan status langsung diterapkan pada kasir.</CardDescription>
          <CardAction>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Cari menu..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Stasiun</TableHead>
                <TableHead>Harga jual</TableHead>
                <TableHead>Ketersediaan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => (
                <MenuRow key={product.id} product={product} pending={pending} onSave={onSave} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Alert>
        <Sparkles />
        <AlertDescription>Harga di sini menjadi sumber utama transaksi. Setiap pesanan menyimpan snapshot harga pada saat dibayar.</AlertDescription>
      </Alert>
    </div>
  );
}

function DiscountManager({
  discounts,
  pending,
  onCreate,
  onSetActive,
  onRemove,
}: {
  discounts: Discount[];
  pending: boolean;
  onCreate: (input: NewDiscountInput) => Promise<unknown>;
  onSetActive: (discountId: number, active: boolean) => Promise<unknown>;
  onRemove: (discountId: number) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"Percent" | "Fixed">("Percent");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [discountToRemove, setDiscountToRemove] = useState<Discount | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valueNumber = Number(value);
    const minNumber = minSubtotal === "" ? 0 : Number(minSubtotal);
    const maxNumber = kind === "Percent" && maxAmount !== "" ? Number(maxAmount) : null;
    if (name.trim().length < 2) {
      toast.error("Nama diskon minimal 2 karakter.");
      return;
    }
    if (!Number.isInteger(valueNumber) || valueNumber < 1 || (kind === "Percent" && valueNumber > 100)) {
      toast.error(kind === "Percent" ? "Persentase diskon harus 1–100." : "Nominal diskon harus lebih dari Rp0.");
      return;
    }
    if (!Number.isInteger(minNumber) || minNumber < 0) {
      toast.error("Minimal belanja tidak valid.");
      return;
    }
    if (maxNumber !== null && (!Number.isInteger(maxNumber) || maxNumber < 1)) {
      toast.error("Batas potongan maksimal tidak valid.");
      return;
    }
    const result = await onCreate({
      name: name.trim(),
      kind,
      value: valueNumber,
      minSubtotal: minNumber,
      maxAmount: maxNumber,
      active: true,
    });
    if (result !== null) {
      setName("");
      setValue("");
      setMinSubtotal("");
      setMaxAmount("");
    }
  }

  return (
    <Card data-tour="menu-discount">
      <CardHeader>
        <CardTitle>Master diskon</CardTitle>
        <CardDescription>Diskon dipilih kasir saat pembayaran. Potongan dihitung sebelum pajak.</CardDescription>
        <CardAction><Tag className="size-5 text-muted-foreground" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label>Nama diskon</Label>
            <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Member 10%" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Jenis</Label>
            <Select value={kind} onValueChange={(next) => setKind(next as "Percent" | "Fixed")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Percent">Persentase (%)</SelectItem>
                <SelectItem value="Fixed">Nominal (Rp)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{kind === "Percent" ? "Persentase (1–100)" : "Nominal potongan (Rp)"}</Label>
            {kind === "Percent"
              ? <Input type="number" inputMode="numeric" min={1} step={1} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Contoh: 10" />
              : <RupiahInput value={value} onValueChange={setValue} placeholder="Contoh: 5.000" />}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Minimal belanja (Rp)</Label>
            <RupiahInput value={minSubtotal} onValueChange={setMinSubtotal} placeholder="Kosongkan jika tidak ada" />
          </div>
          {kind === "Percent" && (
            <div className="flex flex-col gap-2">
              <Label>Batas potongan maksimal (Rp)</Label>
              <RupiahInput value={maxAmount} onValueChange={setMaxAmount} placeholder="Kosongkan jika tanpa batas" />
            </div>
          )}
          <div className="flex items-end md:col-span-2 xl:col-span-3">
            <Button type="submit" disabled={pending}>Tambah diskon <Plus data-icon="inline-end" /></Button>
          </div>
        </form>
        {discounts.length === 0 ? (
          <EmptyState text="Belum ada master diskon. Tambahkan diskon pertama di atas." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Potongan</TableHead>
                <TableHead>Min. belanja</TableHead>
                <TableHead>Batas maks.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell className="font-semibold">{discount.name}</TableCell>
                  <TableCell>{discount.kind === "Percent" ? `${discount.value}%` : money(discount.value)}</TableCell>
                  <TableCell>{discount.minSubtotal > 0 ? money(discount.minSubtotal) : "—"}</TableCell>
                  <TableCell>{discount.maxAmount !== null ? money(discount.maxAmount) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={discount.active ? "default" : "secondary"}>{discount.active ? "Aktif" : "Nonaktif"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => onSetActive(discount.id, !discount.active)}>
                        {discount.active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        title="Hapus diskon"
                        aria-label={`Hapus diskon ${discount.name}`}
                        onClick={() => setDiscountToRemove(discount)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {discountToRemove && (
          <ConfirmDialog
            title={`Hapus diskon "${discountToRemove.name}"?`}
            description="Riwayat transaksi lama tetap menyimpan nama dan potongannya."
            confirmLabel="Hapus diskon"
            onClose={() => setDiscountToRemove(null)}
            onConfirm={() => {
              const discountId = discountToRemove.id;
              setDiscountToRemove(null);
              void onRemove(discountId);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function MenuRow({
  product,
  pending,
  onSave,
}: {
  product: Product;
  pending: boolean;
  onSave: (id: number, patch: { price?: number; active?: boolean; station?: "Kitchen" | "Barista" }) => Promise<unknown>;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [editing, setEditing] = useState(false);
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">{product.icon || "☕"}</span>
          <div className="flex flex-col">
            <span className="font-semibold">{product.name}</span>
            <span className="text-sm text-muted-foreground">{product.note || "Menu reguler"}</span>
          </div>
        </div>
      </TableCell>
      <TableCell><Badge variant="secondary">{product.category}</Badge></TableCell>
      <TableCell>
        <Select value={product.station} disabled={pending} onValueChange={(next) => onSave(product.id, { station: next as "Kitchen" | "Barista" })}>
          <SelectTrigger size="sm" className="w-32" aria-label={`Stasiun ${product.name}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Barista">Barista</SelectItem>
            <SelectItem value="Kitchen">Kitchen</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {editing
          ? <RupiahInput aria-label={`Harga ${product.name}`} value={price} onValueChange={setPrice} className="w-32" />
          : <span className="font-semibold">{money(product.price)}</span>}
      </TableCell>
      <TableCell>
        <Badge variant={product.active && product.available ? "default" : "secondary"}>
          {!product.active ? "Nonaktif" : product.available ? "Tersedia" : "Stok habis"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <Button size="sm" disabled={pending} onClick={async () => {
                const value = Number(price);
                if (!Number.isInteger(value) || value < 1000) { toast.error("Harga minimal Rp1.000."); return; }
                const saved = await onSave(product.id, { price: value });
                if (saved !== null) setEditing(false);
              }}>Simpan</Button>
              <Button variant="outline" size="sm" onClick={() => { setPrice(String(product.price)); setEditing(false); }}>Batal</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Ubah harga</Button>
              <Switch
                checked={product.active}
                disabled={pending}
                aria-label={product.active ? "Nonaktifkan menu" : "Aktifkan menu"}
                title={product.active ? "Nonaktifkan menu" : "Aktifkan menu"}
                onCheckedChange={() => onSave(product.id, { active: !product.active })}
              />
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function InventoryScreen({
  data,
  pending,
  onAdjust,
  onCreate,
}: {
  data: PosBootstrap;
  pending: boolean;
  onAdjust: (input: { ingredientId: string; amount: number; reason: string }) => Promise<unknown>;
  onCreate: (input: NewIngredientInput) => Promise<unknown>;
}) {
  const [ingredientId, setIngredientId] = useState(data.ingredients[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [movementFilter, setMovementFilter] = useState("Semua");
  const lowStock = data.ingredients.filter((ingredient) => ingredient.onHand - ingredient.reserved <= ingredient.minimum).length;
  const filteredMovements = data.movements.filter((movement) => movementFilter === "Semua" || movement.type === movementFilter);
  const movementTypes = ["Semua", ...new Set(data.movements.map((movement) => movement.type))];
  const selectedIngredient = data.ingredients.find((ingredient) => ingredient.id === ingredientId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const change = Number(amount);
    if (!Number.isFinite(change) || change === 0 || !reason.trim()) {
      toast.error("Isi jumlah perubahan dan alasan.");
      return;
    }
    const result = await onAdjust({ ingredientId, amount: change, reason: reason.trim() });
    if (result !== null) {
      setAmount("");
      setReason("");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle eyebrow="Bahan baku & mutasi" title="Inventory" action={<Badge variant={lowStock ? "destructive" : "secondary"}>{lowStock ? `${lowStock} stok perlu dicek` : "Semua stok aman"}</Badge>} />
      <div className="grid gap-2 md:grid-cols-3">
        <MetricCard icon={Boxes} label="Jenis bahan" value={String(data.ingredients.length)} note="Bahan baku aktif" tone="bg-primary/10 text-primary" />
        <MetricCard icon={AlertTriangle} label="Perlu restock" value={String(lowStock)} note="Menyentuh batas minimum" tone="bg-amber-500/10 text-amber-600" />
        <MetricCard icon={ArrowDownRight} label="Mutasi tercatat" value={String(data.movements.length)} note="Riwayat terbaru" tone="bg-emerald-500/10 text-emerald-600" />
      </div>
      <div className="grid gap-2 xl:grid-cols-[1.4fr_1fr]">
        <Card data-tour="inventory-stock">
          <CardHeader>
            <CardTitle>Stok bahan baku</CardTitle>
            <CardDescription>Stok tersedia dihitung setelah reservasi tiket.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bahan</TableHead>
                  <TableHead>On hand</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Tersedia</TableHead>
                  <TableHead>Minimum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ingredients.map((ingredient) => {
                  const available = ingredient.onHand - ingredient.reserved;
                  const low = available <= ingredient.minimum;
                  return (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-semibold">{ingredient.name}</TableCell>
                      <TableCell>{ingredient.onHand} {ingredient.unit}</TableCell>
                      <TableCell>{ingredient.reserved} {ingredient.unit}</TableCell>
                      <TableCell className={low ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>{available} {ingredient.unit}</TableCell>
                      <TableCell>{ingredient.minimum} {ingredient.unit}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card data-tour="inventory-adjust">
          <CardHeader>
            <CardTitle>Catat perubahan stok</CardTitle>
            <CardDescription>Barang masuk atau koreksi stok opname.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Bahan baku</Label>
                <Select value={ingredientId} onValueChange={(next) => setIngredientId(next ?? "")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {data.ingredients.map((ingredient) => <SelectItem value={ingredient.id} key={ingredient.id}>{ingredient.name} ({ingredient.unit})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Perubahan jumlah</Label>
                <Input type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Positif untuk masuk, negatif untuk koreksi" />
              </div>
              {selectedIngredient && (
                <Alert>
                  <AlertDescription>Stok tersedia saat ini <strong>{selectedIngredient.onHand - selectedIngredient.reserved} {selectedIngredient.unit}</strong></AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col gap-2">
                <Label>Alasan mutasi</Label>
                <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contoh: penerimaan stok pemasok" maxLength={160} />
              </div>
              <Button type="submit" disabled={pending}><Check data-icon="inline-start" /> Simpan mutasi</Button>
              <p className="text-sm text-muted-foreground">Stok tidak dapat dikurangi di bawah jumlah yang sudah direservasi untuk tiket.</p>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tambah bahan baku</CardTitle>
          <CardDescription>Bahan baru bisa langsung dipakai sebagai resep menu.</CardDescription>
        </CardHeader>
        <CardContent>
          <IngredientForm pending={pending} onCreate={onCreate} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Riwayat mutasi</CardTitle>
          <CardDescription>Reservasi saat pembayaran; Stock Out saat produksi. Audit/Waste hanya klasifikasi, bukan stok masuk.</CardDescription>
          <CardAction>
            <Select value={movementFilter} onValueChange={(next) => setMovementFilter(next ?? "Semua")}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {movementTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Bahan</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Perubahan</TableHead>
                <TableHead>Alasan / pesanan</TableHead>
                <TableHead>Oleh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{fullDate(movement.createdAt)} · {dateTime(movement.createdAt)}</TableCell>
                  <TableCell className="font-semibold">{movement.ingredientName}</TableCell>
                  <TableCell><Badge variant="secondary">{movement.type}</Badge></TableCell>
                  <TableCell className={movement.type === "Audit / Waste" || movement.amount < 0 ? "text-amber-600" : "text-emerald-600"}>
                    {movement.type === "Audit / Waste"
                      ? `${movement.amount} ${movement.unit ?? ""} · waste`
                      : `${movement.amount > 0 ? "+" : ""}${movement.amount} ${movement.unit ?? ""}`}
                  </TableCell>
                  <TableCell>{movement.reason}{movement.orderNumber && <span className="text-muted-foreground"> · {movement.orderNumber}</span>}</TableCell>
                  <TableCell>{movement.actor}</TableCell>
                </TableRow>
              ))}
              {filteredMovements.length === 0 && (
                <TableRow><TableCell colSpan={6}><EmptyState text="Belum ada mutasi untuk filter ini." /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const expenseSourceLabels: Record<ExpenseSource, string> = { Drawer: "Dari laci kasir", "Non-cash": "Non-tunai" };
const expenseStatusLabels: Record<ExpenseStatus, string> = {
  Pending: "Menunggu persetujuan",
  Approved: "Disetujui",
  Rejected: "Ditolak",
};

function CashScreen({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const threshold = data.expenseApprovalThreshold;
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle
        eyebrow="Kas & pengeluaran"
        title="Kas"
        action={(
          <div className="flex items-center gap-2">
            <Badge variant={data.cashShift ? "default" : "secondary"}>{data.cashShift ? "Shift dibuka" : "Shift belum dibuka"}</Badge>
            <Button type="button" variant="outline" size="sm" data-tour="cash-drawer" disabled={pending || data.printer.mode === "off"} onClick={() => openCashDrawer(runAction)}>
              Buka laci
            </Button>
          </div>
        )}
      />
      <div className="grid gap-2 xl:grid-cols-2">
        <ShiftCard shift={data.cashShift} pending={pending} runAction={runAction} />
        <ExpenseForm
          shift={data.cashShift}
          ingredients={data.expenseIngredients}
          picSuggestions={data.expensePicSuggestions}
          defaultPic={data.user.name}
          threshold={threshold}
          pending={pending}
          runAction={runAction}
        />
      </div>
      <ReceivablesCard
        receivables={data.receivables}
        cashShiftOpen={data.cashShift !== null}
        pending={pending}
        runAction={runAction}
      />
      <Card>
        <CardHeader>
          <CardTitle>Pengeluaran</CardTitle>
          <CardDescription>Belanja yang tercatat, lengkap dengan foto nota</CardDescription>
          <CardAction><Receipt className="size-5 text-muted-foreground" /></CardAction>
        </CardHeader>
        <CardContent>
          <ExpenseTable expenses={data.expenses} isAdmin={data.user.role === "admin"} pending={pending} runAction={runAction} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Riwayat shift</CardTitle>
          <CardDescription>Hasil penutupan kas dan selisih</CardDescription>
          <CardAction><Banknote className="size-5 text-muted-foreground" /></CardAction>
        </CardHeader>
        <CardContent>
          <ShiftHistoryTable shifts={data.recentShifts} />
        </CardContent>
      </Card>
    </div>
  );
}

function ReceivablesCard({
  receivables,
  cashShiftOpen,
  pending,
  runAction,
}: {
  receivables: Receivable[];
  cashShiftOpen: boolean;
  pending: boolean;
  runAction: RunAction;
}) {
  const [settling, setSettling] = useState<Receivable | null>(null);
  const totalOutstanding = receivables.reduce((sum, receivable) => sum + receivable.outstanding, 0);
  return (
    <Card data-tour="cash-receivables">
      <CardHeader>
        <CardTitle>Piutang kasbon</CardTitle>
        <CardDescription>Pesanan bayar nanti yang belum lunas · total sisa {money(totalOutstanding)}</CardDescription>
        <CardAction><HandCoins className="size-5 text-muted-foreground" /></CardAction>
      </CardHeader>
      <CardContent>
        {receivables.length === 0 ? <EmptyState text="Tidak ada piutang kasbon." /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Pesanan</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Dibayar</TableHead>
                <TableHead>Sisa</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((receivable) => (
                <TableRow key={receivable.orderId}>
                  <TableCell>{dateTime(receivable.createdAt)}</TableCell>
                  <TableCell className="font-medium">{receivable.customerName}</TableCell>
                  <TableCell>{receivable.orderNumber}</TableCell>
                  <TableCell>{money(receivable.total)}</TableCell>
                  <TableCell>{money(receivable.paid)}</TableCell>
                  <TableCell className="font-semibold">{money(receivable.outstanding)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setSettling(receivable)}>
                      Bayar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {settling && (
        <SettleReceivableDialog
          key={settling.orderId}
          receivable={settling}
          cashShiftOpen={cashShiftOpen}
          pending={pending}
          runAction={runAction}
          onClose={() => setSettling(null)}
        />
      )}
    </Card>
  );
}

const CREDIT_METHODS = ["Cash", "QRIS", "Debit/Kredit"] as const;
type CreditMethod = (typeof CREDIT_METHODS)[number];

function SettleReceivableDialog({
  receivable,
  cashShiftOpen,
  pending,
  runAction,
  onClose,
}: {
  receivable: Receivable;
  cashShiftOpen: boolean;
  pending: boolean;
  runAction: RunAction;
  onClose: () => void;
}) {
  const [amountInput, setAmountInput] = useState(String(receivable.outstanding));
  const [method, setMethod] = useState<CreditMethod>("Cash");
  const [cashInput, setCashInput] = useState("");
  const amount = Number(amountInput);
  const validAmount = Number.isInteger(amount) && amount > 0 && amount <= receivable.outstanding;
  const isCash = method === "Cash";
  const cashReceived = Number(cashInput || 0);
  const cashBlocked = isCash && !cashShiftOpen;
  const cashShort = isCash && validAmount && cashReceived < amount;
  const canSubmit = validAmount && !cashBlocked && !cashShort && !pending && (!isCash || cashInput !== "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await runAction(
      () => requestJson(`/api/orders/${receivable.orderId}/credit-payment`, "POST", {
        amount,
        method,
        cashReceived: isCash ? cashReceived : null,
      }),
      amount === receivable.outstanding ? "Kasbon lunas." : "Cicilan kasbon dicatat.",
    );
    if (result !== null) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open && !pending) onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Bayar kasbon</DialogTitle>
            <DialogDescription>{receivable.customerName} · {receivable.orderNumber} · sisa {money(receivable.outstanding)}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settle-amount">Nominal dibayar</Label>
            <RupiahInput
              id="settle-amount"
              className="h-12 text-lg tabular-nums"
              value={amountInput}
              onValueChange={setAmountInput}
            />
            {amountInput !== "" && !validAmount && (
              <p className="text-sm text-destructive">Nominal harus antara 1 dan {money(receivable.outstanding)}.</p>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {CREDIT_METHODS.map((option) => (
              <Button
                type="button"
                key={option}
                variant={method === option ? "default" : "outline"}
                aria-pressed={method === option}
                onClick={() => setMethod(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          {isCash && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settle-cash">Uang diterima</Label>
              <RupiahInput
                id="settle-cash"
                className="h-12 text-lg tabular-nums"
                placeholder="Masukkan nominal"
                value={cashInput}
                onValueChange={setCashInput}
              />
              {cashShort && cashInput !== "" && <p className="text-sm font-medium text-destructive">Uang kurang {money(amount - cashReceived)}</p>}
              {validAmount && cashInput !== "" && !cashShort && (
                <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3 text-primary"><span>Kembalian</span><strong className="tabular-nums">{money(cashReceived - amount)}</strong></div>
              )}
            </div>
          )}
          {cashBlocked && <Alert variant="destructive"><AlertDescription>Shift kas belum dibuka. Buka shift untuk menerima pembayaran tunai.</AlertDescription></Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Batal</Button>
            <Button type="submit" disabled={!canSubmit}>{pending ? "Memproses..." : "Catat pembayaran"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShiftCard({ shift, pending, runAction }: { shift: CashShift | null; pending: boolean; runAction: RunAction }) {
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const counted = countedCash === "" ? null : Number(countedCash);
  const liveDifference = shift && counted !== null && Number.isFinite(counted) ? counted - shift.expectedCash : null;
  const breakdown = shift?.breakdown ?? { cashSales: 0, cashRefunds: 0, drawerExpenses: 0 };

  async function openShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const floatValue = Number(openingFloat || "0");
    if (!Number.isInteger(floatValue) || floatValue < 0) {
      toast.error("Modal awal harus angka bulat, minimal 0.");
      return;
    }
    const result = await runAction(
      () => requestJson("/api/cash/shifts", "POST", { openingFloat: floatValue }),
      "Shift kas dibuka.",
    );
    if (result !== null) setOpeningFloat("0");
  }

  async function closeShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shift) return;
    if (counted === null || !Number.isInteger(counted) || counted < 0) {
      toast.error("Isi jumlah uang yang dihitung di laci.");
      return;
    }
    const result = await runAction(
      () => requestJson("/api/cash/shifts/close", "POST", { countedCash: counted, closeNote: closeNote.trim() }),
      "Shift kas ditutup.",
    );
    if (result !== null) {
      setCountedCash("");
      setCloseNote("");
    }
  }

  return (
    <Card data-tour="cash-shift">
      <CardHeader>
        <CardTitle>Shift kas</CardTitle>
        <CardDescription>{shift ? `Dibuka ${dateTime(shift.openedAt)} oleh ${shift.openedByName}` : "Buka shift sebelum menerima pembayaran tunai."}</CardDescription>
        <CardAction><Banknote className="size-5 text-muted-foreground" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {shift === null ? (
          <form className="flex flex-col gap-4" onSubmit={openShift}>
            <div className="flex flex-col gap-2">
              <Label>Modal awal laci (Rp)</Label>
              <RupiahInput value={openingFloat} onValueChange={setOpeningFloat} />
            </div>
            <Button type="submit" disabled={pending}>Buka shift <ArrowRight data-icon="inline-end" /></Button>
          </form>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-muted/50 p-4 text-sm">
              <dt className="text-muted-foreground">Modal awal</dt>
              <dd className="text-right font-medium">{money(shift.openingFloat)}</dd>
              <dt className="text-muted-foreground">Penjualan tunai</dt>
              <dd className="text-right font-medium">{money(breakdown.cashSales)}</dd>
              <dt className="text-muted-foreground">Refund tunai</dt>
              <dd className="text-right font-medium">−{money(breakdown.cashRefunds)}</dd>
              <dt className="text-muted-foreground">Pengeluaran dari laci</dt>
              <dd className="text-right font-medium">−{money(breakdown.drawerExpenses)}</dd>
              <dt className="border-t pt-2 font-semibold">Kas seharusnya</dt>
              <dd className="border-t pt-2 text-right text-base font-semibold">{money(shift.expectedCash)}</dd>
            </dl>
            <form className="flex flex-col gap-4" onSubmit={closeShift}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Uang dihitung di laci (Rp)</Label>
                  <RupiahInput value={countedCash} onValueChange={setCountedCash} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Selisih</Label>
                  <div className={`flex h-9 items-center rounded-md border px-3 font-semibold ${liveDifference === null ? "" : liveDifference === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {liveDifference === null ? "—" : money(liveDifference)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Catatan penutupan</Label>
                <Input value={closeNote} maxLength={240} onChange={(event) => setCloseNote(event.target.value)} placeholder="Opsional" />
              </div>
              <Button type="submit" disabled={pending || counted === null}>Tutup shift</Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseForm({
  shift,
  ingredients,
  picSuggestions,
  defaultPic,
  threshold,
  pending,
  runAction,
}: {
  shift: CashShift | null;
  ingredients: PosBootstrap["expenseIngredients"];
  picSuggestions: string[];
  defaultPic: string;
  threshold: number;
  pending: boolean;
  runAction: RunAction;
}) {
  const listId = useId();
  const [source, setSource] = useState<ExpenseSource>("Drawer");
  const [picName, setPicName] = useState(defaultPic);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptKey, setReceiptKey] = useState(0);
  const activeIngredientId = ingredients.some((ingredient) => ingredient.id === ingredientId) ? ingredientId : ingredients[0]?.id ?? "";
  const selectedIngredient = ingredients.find((ingredient) => ingredient.id === activeIngredientId);
  const drawerBlocked = source === "Drawer" && !shift;
  const totalValue = Number(total);
  const needsApproval = total !== "" && Number.isFinite(totalValue) && totalValue > threshold;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantityValue = Number(quantity);
    if (!picName.trim() || !activeIngredientId || !(quantityValue > 0) || !Number.isInteger(totalValue) || totalValue <= 0) {
      toast.error("Lengkapi PIC, bahan, jumlah, dan total harga.");
      return;
    }
    if (!receipt) {
      toast.error("Foto nota wajib dilampirkan.");
      return;
    }
    const form = new FormData();
    form.append("source", source);
    form.append("picName", picName.trim());
    form.append("ingredientId", activeIngredientId);
    form.append("quantity", String(quantityValue));
    form.append("total", String(totalValue));
    form.append("note", note.trim());
    form.append("receipt", receipt);
    const result = await runAction(() => requestJson("/api/expenses", "POST", form), "Pengeluaran berhasil dicatat.");
    if (result !== null) {
      setQuantity("");
      setTotal("");
      setNote("");
      setReceipt(null);
      setReceiptKey((key) => key + 1);
    }
  }

  return (
    <Card data-tour="cash-expenses">
      <CardHeader>
        <CardTitle>Catat pengeluaran</CardTitle>
        <CardDescription>Belanja stok otomatis menambah stok bahan.</CardDescription>
        <CardAction><Receipt className="size-5 text-muted-foreground" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {drawerBlocked && (
          <Alert variant="destructive">
            <AlertDescription>Buka shift kas dulu untuk belanja dari laci.</AlertDescription>
          </Alert>
        )}
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label>Sumber dana</Label>
            <Select value={source} onValueChange={(next) => setSource(next as ExpenseSource)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Drawer">{expenseSourceLabels.Drawer}</SelectItem>
                <SelectItem value="Non-cash">{expenseSourceLabels["Non-cash"]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>PIC pembeli</Label>
            <Input list={listId} value={picName} maxLength={60} onChange={(event) => setPicName(event.target.value)} placeholder="Nama yang berbelanja" />
            <datalist id={listId}>
              {picSuggestions.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Bahan dibeli</Label>
            <Select value={activeIngredientId} onValueChange={(next) => setIngredientId(next ?? "")} disabled={ingredients.length === 0}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Belum ada bahan" /></SelectTrigger>
              <SelectContent>
                {ingredients.map((ingredient) => (
                  <SelectItem key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Jumlah{selectedIngredient ? ` (${selectedIngredient.unit})` : ""}</Label>
            <Input type="number" min={0} step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Total harga (Rp)</Label>
            <RupiahInput value={total} onValueChange={setTotal} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Catatan</Label>
            <Input value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} placeholder="Opsional" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Foto nota (wajib)</Label>
            <Input key={receiptKey} type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            {needsApproval
              ? `Di atas ${money(threshold)}: pengeluaran menunggu persetujuan admin.`
              : `Sampai ${money(threshold)}: otomatis disetujui.`}
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || drawerBlocked || ingredients.length === 0}>Simpan pengeluaran</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ExpenseTable({
  expenses,
  isAdmin,
  pending,
  runAction,
}: {
  expenses: Expense[];
  isAdmin: boolean;
  pending: boolean;
  runAction: RunAction;
}) {
  function decide(expense: Expense, action: "approve" | "reject") {
    return runAction(
      () => requestJson(`/api/expenses/${expense.id}`, "PATCH", { action }),
      action === "approve" ? "Pengeluaran disetujui." : "Pengeluaran ditolak, stok dikembalikan.",
    );
  }

  if (expenses.length === 0) return <EmptyState text="Belum ada pengeluaran." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Waktu</TableHead>
          <TableHead>Sumber</TableHead>
          <TableHead>PIC</TableHead>
          <TableHead>Bahan</TableHead>
          <TableHead>Jumlah</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Nota</TableHead>
          <TableHead>Status</TableHead>
          {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>{dateTime(expense.createdAt)}</TableCell>
            <TableCell>{expenseSourceLabels[expense.source]}</TableCell>
            <TableCell>{expense.picName}</TableCell>
            <TableCell>{expense.ingredientName}</TableCell>
            <TableCell>{expense.quantity} {expense.unit}</TableCell>
            <TableCell className="font-medium">{money(expense.total)}</TableCell>
            <TableCell><a className="text-primary underline-offset-4 hover:underline" href={expense.receiptUrl} target="_blank" rel="noreferrer">Lihat nota</a></TableCell>
            <TableCell>
              <Badge variant={expense.status === "Approved" ? "default" : expense.status === "Rejected" ? "destructive" : "secondary"}>
                {expenseStatusLabels[expense.status]}
              </Badge>
            </TableCell>
            {isAdmin && (
              <TableCell>
                {expense.status === "Pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => decide(expense, "approve")}>Setujui</Button>
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => decide(expense, "reject")}>Tolak</Button>
                  </div>
                ) : (
                  <span className="block text-right text-sm text-muted-foreground">{expense.decidedByName ? `oleh ${expense.decidedByName}` : "—"}</span>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ShiftHistoryTable({ shifts }: { shifts: CashShift[] }) {
  const closed = shifts.filter((shift) => shift.closedAt !== null);
  if (closed.length === 0) return <EmptyState text="Belum ada shift yang ditutup." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ditutup</TableHead>
          <TableHead>Oleh</TableHead>
          <TableHead>Modal</TableHead>
          <TableHead>Seharusnya</TableHead>
          <TableHead>Dihitung</TableHead>
          <TableHead>Selisih</TableHead>
          <TableHead>Catatan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {closed.map((shift) => {
          const difference = shift.difference ?? 0;
          return (
            <TableRow key={shift.id}>
              <TableCell>{dateTime(shift.closedAt ?? shift.openedAt)}</TableCell>
              <TableCell>{shift.closedByName ?? shift.openedByName}</TableCell>
              <TableCell>{money(shift.openingFloat)}</TableCell>
              <TableCell>{money(shift.expectedCash)}</TableCell>
              <TableCell>{money(shift.countedCash ?? 0)}</TableCell>
              <TableCell className={difference === 0 ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>{money(difference)}</TableCell>
              <TableCell>{shift.closeNote || "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ReportsScreen({ data }: { data: PosBootstrap }) {
  const summary = data.summary;
  const maxDaily = Math.max(1, ...summary.dailySales.map((sale) => sale.total));
  const orderMethods = useMemo(() => {
    const values = new Map<string, number>();
    for (const order of data.orders) {
      if (order.status === "Cancelled") continue;
      const method = order.paymentMethod ?? "Lainnya";
      values.set(method, (values.get(method) ?? 0) + (order.total ?? 0));
    }
    return [...values.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.orders]);
  const maxMethod = Math.max(1, ...orderMethods.map(([, total]) => total));
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle eyebrow="Performa bisnis" title="Laporan" action={<Badge variant="secondary">7 hari terakhir</Badge>} />
      <div className="grid gap-2 md:grid-cols-3">
        <MetricCard icon={Wallet} label="Penjualan hari ini" value={money(summary.todaySales)} note={`${summary.todayOrders} transaksi non-batal`} tone="bg-emerald-500/10 text-emerald-600" />
        <MetricCard icon={ChartNoAxesCombined} label="Rata-rata per hari" value={money(Math.round(summary.dailySales.reduce((sum, sale) => sum + sale.total, 0) / 7))} note="7 hari terakhir" tone="bg-primary/10 text-primary" />
        <MetricCard icon={ClipboardList} label="Pesanan aktif" value={String(summary.activeOrders)} note="Belum selesai diambil" tone="bg-amber-500/10 text-amber-600" />
      </div>
      <div className="grid gap-2 xl:grid-cols-[1.6fr_1fr]">
        <Card data-tour="reports-trend">
          <CardHeader>
            <CardTitle>Tren penjualan</CardTitle>
            <CardDescription>Nilai transaksi per hari</CardDescription>
            <CardAction><ChartNoAxesCombined className="size-5 text-muted-foreground" /></CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="text-2xl font-semibold tabular-nums">
              {money(summary.dailySales.reduce((sum, item) => sum + item.total, 0))}
              <span className="ml-2 text-sm font-normal text-muted-foreground">Penjualan dalam periode</span>
            </div>
            <div className="flex h-48 items-end gap-2">
              {summary.dailySales.map((sale) => (
                <div className="group flex h-full flex-1 flex-col items-center justify-end gap-1" key={sale.date}>
                  <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{money(sale.total)}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-md bg-primary" style={{ height: `${Math.max(4, sale.total / maxDaily * 100)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{sale.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Metode pembayaran</CardTitle>
            <CardDescription>Ringkasan pada 100 transaksi terbaru</CardDescription>
            <CardAction><CreditCard className="size-5 text-muted-foreground" /></CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {orderMethods.length === 0 ? <EmptyState text="Belum ada transaksi." /> : orderMethods.map(([method, total]) => (
              <div className="flex flex-col gap-2" key={method}>
                <div className="flex items-center justify-between text-sm">
                  <span>{method}</span>
                  <strong className="font-semibold">{money(total)}</strong>
                </div>
                <Progress value={total / maxMethod * 100} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Produk terlaris hari ini</CardTitle>
          <CardDescription>Rekap jumlah item terjual</CardDescription>
          <CardAction><Coffee className="size-5 text-muted-foreground" /></CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.topProducts.length === 0 ? <EmptyState text="Belum ada penjualan hari ini." /> : summary.topProducts.map((product, index) => (
              <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-4" key={product.name}>
                <span className="text-sm text-muted-foreground">0{index + 1}</span>
                <strong className="font-semibold">{product.name}</strong>
                <span className="text-sm">{product.quantity} item</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type RunAction = <T>(work: () => Promise<T>, successMessage: string) => Promise<T | null>;

function Avatar({ src, name, className }: { src: string | null; name: string; className: string }) {
  return (
    <div className={className}>
      {src ? <img src={src} alt="" /> : name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
    </div>
  );
}

function ReceiptLogo({ src }: { src: string | null }) {
  return <div className="receipt-logo">{src ? <img src={src} alt="" /> : "☕"}</div>;
}

function ImageUploadControls({
  hasImage,
  uploadLabel,
  disabled,
  onUpload,
  onRemove,
}: {
  hasImage: boolean;
  uploadLabel: string;
  disabled: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Upload data-icon="inline-start" /> {uploadLabel}
      </Button>
      {hasImage && (
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
          <Trash2 data-icon="inline-start" /> Hapus
        </Button>
      )}
    </div>
  );
}

function StoreProfileCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [storeName, setStoreName] = useState(data.outletName);
  const trimmedName = storeName.trim();

  async function uploadLogo(file: File) {
    const form = new FormData();
    form.append("logo", file);
    await runAction(() => requestJson("/api/settings/logo", "POST", form), "Logo toko diperbarui.");
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(() => requestJson("/api/settings", "PATCH", { outletName: trimmedName }), "Nama toko tersimpan.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Store className="size-5 text-muted-foreground" /> Profil toko</CardTitle>
        <CardDescription>Nama dan logo tampil di sidebar, nota, dan tiket cetak.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {data.outletLogoUrl ? <img className="size-full object-cover" src={data.outletLogoUrl} alt="Logo toko" /> : <Coffee className="size-6 text-muted-foreground" />}
          </div>
          <ImageUploadControls
            hasImage={data.outletLogoUrl !== null}
            uploadLabel="Unggah logo"
            disabled={pending}
            onUpload={uploadLogo}
            onRemove={() => runAction(() => requestJson("/api/settings/logo", "DELETE"), "Logo toko dihapus.")}
          />
        </div>
        <form className="flex flex-col gap-4" onSubmit={saveName}>
          <div className="flex flex-col gap-2">
            <Label>Nama toko</Label>
            <Input value={storeName} maxLength={60} onChange={(event) => setStoreName(event.target.value)} />
          </div>
          <Button type="submit" disabled={pending || trimmedName.length < 3 || trimmedName === data.outletName}>
            Simpan nama toko <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [displayName, setDisplayName] = useState(data.user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const trimmedName = displayName.trim();

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.append("avatar", file);
    await runAction(() => requestJson("/api/account/avatar", "POST", form), "Foto profil diperbarui.");
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(() => requestJson("/api/account", "PATCH", { name: trimmedName }), "Nama akun tersimpan.");
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak sama.");
      return;
    }
    const result = await runAction(
      () => requestJson("/api/account/password", "POST", { currentPassword, newPassword }),
      "Password berhasil diubah.",
    );
    if (result !== null) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserRound className="size-5 text-muted-foreground" /> Akun saya</CardTitle>
        <CardDescription>Foto dan nama Anda tampil di sidebar dan topbar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={data.userAvatarUrl} name={data.user.name} className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary" />
          <ImageUploadControls
            hasImage={data.userAvatarUrl !== null}
            uploadLabel="Ganti foto"
            disabled={pending}
            onUpload={uploadAvatar}
            onRemove={() => runAction(() => requestJson("/api/account/avatar", "DELETE"), "Foto profil dihapus.")}
          />
        </div>
        <form className="flex flex-col gap-4" onSubmit={saveName}>
          <div className="flex flex-col gap-2">
            <Label>Nama tampilan</Label>
            <Input value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <Button type="submit" disabled={pending || trimmedName.length < 2 || trimmedName === data.user.name}>
            Simpan nama <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        <Separator />
        <form className="flex flex-col gap-4" onSubmit={savePassword}>
          <span className="font-medium">Ubah password</span>
          <div className="flex flex-col gap-2">
            <Label>Password saat ini</Label>
            <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Password baru</Label>
            <Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Ulangi password baru</Label>
            <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <Button
            type="submit"
            disabled={pending || !currentPassword || newPassword.length < 8 || !confirmPassword}
          >
            Ubah password <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountsCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const otherAccounts = data.accounts.filter((account) => account.id !== data.user.id);

  function toggleReset(accountId: string) {
    setResetId(resetId === accountId ? null : accountId);
    setResetPassword("");
  }

  async function resetAccount(event: FormEvent<HTMLFormElement>, account: ManagedAccount) {
    event.preventDefault();
    const result = await runAction(
      () => requestJson(`/api/accounts/${account.id}/password`, "POST", { newPassword: resetPassword }),
      `Password ${account.name} berhasil diatur ulang.`,
    );
    if (result !== null) {
      setResetId(null);
      setResetPassword("");
    }
  }

  return (
    <Card className="lg:col-span-2" data-tour="settings-accounts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-5 text-muted-foreground" /> Kelola akun</CardTitle>
        <CardDescription>Atur ulang password akun karyawan jika mereka lupa. Password akun Anda sendiri diubah di bagian Akun saya.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {otherAccounts.length === 0 && <EmptyState text="Belum ada akun karyawan lain." />}
        {otherAccounts.map((account) => (
          <div className="rounded-lg border p-3" key={account.id}>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar src={account.avatarUrl} name={account.name} className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary" />
              <div className="flex min-w-0 flex-1 flex-col">
                <strong className="truncate font-medium">{account.name}</strong>
                <span className="text-sm text-muted-foreground">@{account.username}</span>
              </div>
              <Badge variant="secondary">{roleLabels[account.role]}</Badge>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => toggleReset(account.id)}>
                <KeyRound data-icon="inline-start" /> Atur ulang password
              </Button>
            </div>
            {resetId === account.id && (
              <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(event) => resetAccount(event, account)}>
                <Input
                  className="max-w-xs"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password baru (min. 8 karakter)"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
                <Button type="submit" size="sm" disabled={pending || resetPassword.length < 8}>Simpan</Button>
                <span className="text-sm text-muted-foreground">Sesi aktif akun ini akan keluar otomatis.</span>
              </form>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingsScreen({
  data,
  pending,
  runAction,
}: {
  data: PosBootstrap;
  pending: boolean;
  runAction: RunAction;
}) {
  const [width, setWidth] = useState<58 | 80>(data.receiptWidthMm);
  function saveReceipt() {
    return runAction(
      () => requestJson("/api/settings", "PATCH", { receiptWidthMm: width }),
      "Pengaturan struk berhasil disimpan.",
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle eyebrow="KONFIGURASI OUTLET" title="Pengaturan" />
      <div className="grid gap-2 lg:grid-cols-2">
        <StoreProfileCard data={data} pending={pending} runAction={runAction} />
        <AccountCard data={data} pending={pending} runAction={runAction} />
        <AccountsCard data={data} pending={pending} runAction={runAction} />
        <Card data-tour="settings-printing">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Printer className="size-5 text-muted-foreground" /> Pencetakan nota</CardTitle>
            <CardDescription>Atur lebar kertas printer thermal. Lebar ini juga dipakai saat cetak langsung dari server.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Lebar kertas</Label>
              <Select value={String(width)} onValueChange={(next) => setWidth(Number(next ?? 80) as 58 | 80)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58 mm · compact</SelectItem>
                  <SelectItem value="80">80 mm · standar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mx-auto flex flex-col items-center gap-1 rounded-md border border-dashed bg-muted/40 p-4 text-center text-sm" style={{ width: width === 58 ? "58%" : "80%" }}>
              <span className="font-semibold">{data.outletName}</span>
              <span className="text-muted-foreground">Preview lebar {width} mm</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={saveReceipt} disabled={pending}>Simpan pengaturan <ArrowRight data-icon="inline-end" /></Button>
          </CardFooter>
        </Card>
        <ExpenseApprovalCard data={data} pending={pending} runAction={runAction} />
        <KasbonLimitCard data={data} pending={pending} runAction={runAction} />
        <TablePickerCard data={data} pending={pending} runAction={runAction} />
        <PrinterCard data={data} pending={pending} runAction={runAction} />
        <TaxReceiptCard data={data} pending={pending} runAction={runAction} />
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="size-5 text-muted-foreground" /> Denah meja</CardTitle>
            <CardDescription>Atur meja dan posisinya di peta outlet. Kasir memilih meja dari {data.tablePickerMode === "cards" ? "kartu meja" : "denah yang sama"}.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableLayoutEditor tables={data.tables} shapes={data.mapShapes} pending={pending} runAction={runAction} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="size-5 text-muted-foreground" /> Akses & keamanan</CardTitle>
            <CardDescription>Akun demo menggunakan role operasional dengan izin yang dibatasi di sisi server.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              ["admin", "Kelola menu, stok, laporan, dan pembatalan"],
              ["kasir", "Transaksi, cetak, dan penyelesaian pickup"],
              ["barista", "Lihat dan proses tiket minuman"],
              ["kitchen", "Lihat dan proses tiket makanan"],
            ].map(([label, description]) => (
              <div className="flex items-center gap-3 text-sm" key={label}>
                <Badge variant="secondary" className="w-20 justify-center">{label}</Badge>
                <span className="text-muted-foreground">{description}</span>
              </div>
            ))}
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" /> Server berjalan lokal · Database SQLite
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function taxPercentToBasisPoints(value: string): number | null {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 30) return null;
  return Math.round(percent * 100);
}

type PrinterFormMode = PosBootstrap["printer"]["mode"];

const PORT_SCAN_INTERVAL_MS = 3000;

// Dipakai di Pengaturan dan Kas. Server menolak jika printer belum diatur.
function openCashDrawer(runAction: RunAction) {
  return runAction(() => requestJson("/api/cash/drawer/open", "POST"), "Perintah buka laci dikirim.");
}

function ExpenseApprovalCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [threshold, setThreshold] = useState(String(data.expenseApprovalThreshold));

  function save() {
    const value = Number(threshold);
    if (!Number.isInteger(value) || value < 0) {
      toast.error("Batas harus angka bulat, minimal 0.");
      return;
    }
    return runAction(
      () => requestJson("/api/settings", "PATCH", { expenseApprovalThreshold: value }),
      "Batas persetujuan pengeluaran disimpan.",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Banknote className="size-5 text-muted-foreground" /> Persetujuan pengeluaran</CardTitle>
        <CardDescription>Pengeluaran di atas batas ini menunggu persetujuan admin. Bahan tetap masuk stok dan pengeluaran laci tetap dihitung sampai ditolak.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label>Batas (Rp)</Label>
        <RupiahInput value={threshold} onValueChange={setThreshold} />
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={pending}>Simpan batas <ArrowRight data-icon="inline-end" /></Button>
      </CardFooter>
    </Card>
  );
}

function KasbonLimitCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [limit, setLimit] = useState(String(data.kasbonLimit));

  function save() {
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 0) {
      toast.error("Batas harus angka bulat, minimal 0.");
      return;
    }
    return runAction(
      () => requestJson("/api/settings", "PATCH", { kasbonLimit: value }),
      "Batas kasbon disimpan.",
    );
  }

  return (
    <Card data-tour="settings-kasbon">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HandCoins className="size-5 text-muted-foreground" /> Batas kasbon</CardTitle>
        <CardDescription>Total piutang per pelanggan (nama sama) tidak boleh melebihi batas ini, termasuk pesanan baru.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label>Batas per pelanggan (Rp)</Label>
        <RupiahInput value={limit} onValueChange={setLimit} />
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={pending}>Simpan batas <ArrowRight data-icon="inline-end" /></Button>
      </CardFooter>
    </Card>
  );
}

function TablePickerCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [mode, setMode] = useState<TablePickerMode>(data.tablePickerMode);

  return (
    <Card data-tour="settings-table-picker">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LayoutGrid className="size-5 text-muted-foreground" /> Pemilihan meja kasir</CardTitle>
        <CardDescription>Pilih cara kasir memilih meja. Kartu meja bisa dipakai tanpa denah peta.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label>Tampilan</Label>
        <Select value={mode} onValueChange={(next) => setMode((next ?? "map") as TablePickerMode)}>
          <SelectTrigger className="w-full">
            <SelectValue>{(value: string) => (value === "cards" ? "Kartu meja" : "Denah peta")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="map">Denah peta</SelectItem>
            <SelectItem value="cards">Kartu meja</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => runAction(() => requestJson("/api/settings", "PATCH", { tablePickerMode: mode }), "Mode pemilihan meja disimpan.")}
          disabled={pending || mode === data.tablePickerMode}
        >
          Simpan mode <ArrowRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function TableCardPicker({ tables, selectedId, onSelect }: { tables: DiningTable[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tables.map((table) => {
        const selected = table.id === selectedId;
        return (
          <button
            type="button"
            key={table.id}
            aria-pressed={selected}
            onClick={() => onSelect(table.id)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50",
              selected && "border-primary ring-2 ring-primary/30",
            )}
          >
            <span className="font-medium">{table.name}</span>
            <Badge variant={table.occupied ? "secondary" : "outline"}>{table.occupied ? "Terisi" : "Kosong"}</Badge>
            {table.openTab && <span className="max-w-full truncate text-xs text-muted-foreground">Tab {table.openTab.customerName}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PrinterCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [mode, setMode] = useState<PrinterFormMode>(data.printer.mode);
  const [host, setHost] = useState(data.printer.host);
  const [port, setPort] = useState(String(data.printer.port));
  const [systemName, setSystemName] = useState(data.printer.systemName);
  const [serialPath, setSerialPath] = useState(data.printer.serialPath);
  const [baudRate, setBaudRate] = useState(String(data.printer.baudRate));
  const [drawerAutoOpen, setDrawerAutoOpen] = useState(data.printer.drawerAutoOpen);
  const [serialPorts, setSerialPorts] = useState<PrinterSerialPort[]>([]);
  const [portScanError, setPortScanError] = useState<string | null>(null);

  // Daftar port diperbarui berkala agar pairing Bluetooth baru langsung terlihat.
  useEffect(() => {
    if (mode !== "serial") return;
    let active = true;
    async function scanPorts() {
      try {
        const result = await requestJson<{ ports: PrinterSerialPort[] }>("/api/printer/ports", "GET");
        if (!active) return;
        setSerialPorts(result.ports);
        setPortScanError(null);
      } catch (error) {
        if (active) setPortScanError(error instanceof Error ? error.message : "Port tidak bisa dibaca.");
      }
    }
    void scanPorts();
    const timer = setInterval(scanPorts, PORT_SCAN_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mode]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const portNumber = Number(port);
    if (mode === "network") {
      if (!host.trim()) {
        toast.error("Isi alamat IP printer, misalnya 192.168.1.50.");
        return;
      }
      if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
        toast.error("Port printer harus antara 1 dan 65535.");
        return;
      }
    }
    if (mode === "system" && !systemName.trim()) {
      toast.error("Isi nama printer seperti yang terdaftar di sistem operasi server.");
      return;
    }
    if (mode === "serial" && !serialPath.trim()) {
      toast.error("Isi port serial printer, misalnya COM3 (Windows) atau /dev/cu.NAMA (macOS).");
      return;
    }
    await runAction(
      () => requestJson("/api/settings", "PATCH", {
        printerMode: mode,
        printerHost: host.trim(),
        printerPort: mode === "network" ? portNumber : data.printer.port,
        printerSystemName: systemName.trim(),
        printerSerialPath: serialPath.trim(),
        printerBaudRate: Number(baudRate),
        drawerAutoOpen,
      }),
      "Pengaturan printer tersimpan.",
    );
  }

  async function testPrint() {
    await runAction(
      () => requestJson("/api/printer/test", "POST"),
      "Tes cetak dikirim. Periksa hasil cetak di printer.",
    );
  }

  async function connectPort(portPath: string) {
    const saved = await runAction(
      () => requestJson("/api/settings", "PATCH", {
        printerMode: "serial",
        printerSerialPath: portPath,
        printerBaudRate: Number(baudRate),
      }),
      `Printer di ${portPath} tersimpan sebagai printer server.`,
    );
    if (saved !== null) {
      setMode("serial");
      setSerialPath(portPath);
    }
  }

  return (
    <Card data-tour="settings-printer">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Printer className="size-5 text-muted-foreground" /> Printer thermal (server)</CardTitle>
        <CardDescription>Nota dan tiket dikirim langsung dari server ke printer. Pilih Nonaktif untuk memakai cetak lewat browser saja.</CardDescription>
      </CardHeader>
      <form onSubmit={save}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Metode koneksi</Label>
            <Select value={mode} onValueChange={(next) => setMode((next ?? "off") as PrinterFormMode)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Nonaktif (cetak lewat browser)</SelectItem>
                <SelectItem value="network">Jaringan LAN (IP:port, umumnya 9100)</SelectItem>
                <SelectItem value="serial">Port serial (Bluetooth Classic / COM / USB-serial)</SelectItem>
                <SelectItem value="system">Printer terpasang di sistem (CUPS di macOS/Linux, antrian printer di Windows)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "network" && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Alamat IP printer</Label>
                <Input value={host} placeholder="192.168.1.50" maxLength={253} onChange={(event) => setHost(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Port</Label>
                <Input type="number" min={1} max={65535} value={port} onChange={(event) => setPort(event.target.value)} />
              </div>
            </>
          )}
          {mode === "serial" && (
            <>
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">Port terdeteksi (diperbarui otomatis)</span>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Live</Badge>
                </div>
                {portScanError && <p className="text-sm text-destructive">{portScanError}</p>}
                {!portScanError && serialPorts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada port. Pasangkan printer Bluetooth lewat Pengaturan Bluetooth Windows, lalu tunggu beberapa detik.</p>
                )}
                {serialPorts.map((port) => {
                  const isSaved = data.printer.mode === "serial" && data.printer.serialPath === port.path;
                  return (
                    <div key={port.path} className={`flex flex-wrap items-center gap-3 rounded-md border p-3 ${isSaved ? "border-primary bg-primary/5" : ""}`}>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <strong className="truncate font-medium">{port.path}</strong>
                        <span className="text-sm text-muted-foreground">{port.manufacturer || "Perangkat serial"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {port.isBluetooth && <Badge variant="secondary">Bluetooth</Badge>}
                        {isSaved && <Badge>Tersimpan</Badge>}
                      </div>
                      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => connectPort(port.path)}>
                        Hubungkan &amp; simpan
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Port serial (isi manual jika tidak terdeteksi)</Label>
                <Input value={serialPath} placeholder="COM3 atau /dev/cu.NAMA-PRINTER" maxLength={255} onChange={(event) => setSerialPath(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Baud rate</Label>
                <Select value={baudRate} onValueChange={(next) => setBaudRate(next ?? baudRate)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRINTER_BAUD_RATES.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>{rate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {mode === "system" && (
            <div className="flex flex-col gap-2">
              <Label>Nama printer di sistem</Label>
              <Input value={systemName} placeholder="EPSON_TM_T82" maxLength={100} onChange={(event) => setSystemName(event.target.value)} />
            </div>
          )}
          {mode !== "off" && (
            <div className="flex items-start gap-2">
              <Checkbox id="drawer-auto-open" checked={drawerAutoOpen} onCheckedChange={(checked) => setDrawerAutoOpen(checked === true)} />
              <Label htmlFor="drawer-auto-open" className="font-normal leading-snug">
                Buka laci otomatis setiap pembayaran tunai (laci terhubung ke printer lewat kabel RJ11)
              </Label>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => openCashDrawer(runAction)} disabled={pending || data.printer.mode === "off"}>Buka laci sekarang</Button>
          <Button type="button" variant="outline" onClick={testPrint} disabled={pending || mode === "off"}>Tes cetak</Button>
          <Button type="submit" disabled={pending}>Simpan printer <ArrowRight data-icon="inline-end" /></Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function TaxReceiptCard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const [taxPercent, setTaxPercent] = useState(String(data.taxRateBasisPoints / 100));
  const [footer, setFooter] = useState(data.receiptFooter);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const basisPoints = taxPercentToBasisPoints(taxPercent);
    if (basisPoints === null) {
      toast.error("Pajak harus antara 0% dan 30%.");
      return;
    }
    await runAction(
      () => requestJson("/api/settings", "PATCH", { taxRateBasisPoints: basisPoints, receiptFooter: footer.trim() }),
      "Pajak dan catatan struk tersimpan.",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="size-5 text-muted-foreground" /> Pajak & catatan struk</CardTitle>
        <CardDescription>Pajak dihitung otomatis di kasir. Catatan kaki tampil di bagian bawah nota.</CardDescription>
      </CardHeader>
      <form onSubmit={save}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Pajak (%)</Label>
            <Input type="number" min={0} max={30} step="0.01" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Catatan kaki struk</Label>
            <Input value={footer} maxLength={120} onChange={(event) => setFooter(event.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>Simpan pajak & catatan <ArrowRight data-icon="inline-end" /></Button>
        </CardFooter>
      </form>
    </Card>
  );
}

type RecipeDraft = { ingredientId: string; amount: string };

function ProductForm({
  data,
  pending,
  onCreate,
}: {
  data: PosBootstrap;
  pending: boolean;
  onCreate: (input: NewProductInput) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [station, setStation] = useState<"Kitchen" | "Barista">("Barista");
  const [icon, setIcon] = useState("");
  const [note, setNote] = useState("");
  const [modifiers, setModifiers] = useState("");
  const [recipe, setRecipe] = useState<RecipeDraft[]>([{ ingredientId: "", amount: "" }]);

  function updateLine(index: number, patch: Partial<RecipeDraft>) {
    setRecipe((lines) => lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const priceValue = Number(price);
    const recipeLines = recipe
      .filter((line) => line.ingredientId && Number(line.amount) > 0)
      .map((line) => ({ ingredientId: line.ingredientId, amount: Number(line.amount) }));
    if (name.trim().length < 2 || category.trim().length < 2) {
      toast.error("Nama dan kategori menu wajib diisi.");
      return;
    }
    if (!Number.isInteger(priceValue) || priceValue < 1000) {
      toast.error("Harga minimal Rp1.000.");
      return;
    }
    if (recipeLines.length === 0) {
      toast.error("Tambahkan minimal satu bahan resep dengan jumlah lebih dari 0.");
      return;
    }
    const result = await onCreate({
      name: name.trim(),
      category: category.trim(),
      price: priceValue,
      station,
      icon: icon.trim(),
      note: note.trim(),
      modifiers: modifiers.split(",").map((item) => item.trim()).filter(Boolean),
      recipe: recipeLines,
    });
    if (result !== null) {
      setName("");
      setCategory("");
      setPrice("");
      setIcon("");
      setNote("");
      setModifiers("");
      setRecipe([{ ingredientId: "", amount: "" }]);
    }
  }

  if (data.ingredients.length === 0) {
    return <EmptyState text="Tambahkan bahan baku di Inventory dulu. Setiap menu membutuhkan resep bahan." />;
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Nama menu</Label>
          <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Es Kopi Susu" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Kategori</Label>
          <Input value={category} maxLength={40} onChange={(event) => setCategory(event.target.value)} placeholder="Contoh: Kopi, Makanan" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Harga jual (Rp)</Label>
          <RupiahInput value={price} onValueChange={setPrice} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Stasiun produksi</Label>
          <Select value={station} onValueChange={(next) => setStation((next ?? "Barista") as "Kitchen" | "Barista")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Barista">Barista · minuman</SelectItem>
              <SelectItem value="Kitchen">Kitchen · makanan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Ikon (emoji)</Label>
          <Input value={icon} maxLength={8} onChange={(event) => setIcon(event.target.value)} placeholder="☕" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Catatan singkat</Label>
          <Input value={note} maxLength={60} onChange={(event) => setNote(event.target.value)} placeholder="Opsional" />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Modifier (pisahkan dengan koma)</Label>
          <Input value={modifiers} onChange={(event) => setModifiers(event.target.value)} placeholder="Less sugar, Extra shot" />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <span className="font-medium">Resep per porsi</span>
        {recipe.map((line, index) => (
          <div className="flex items-center gap-2" key={index}>
            <Select value={line.ingredientId} onValueChange={(next) => updateLine(index, { ingredientId: next ?? "" })}>
              <SelectTrigger className="min-w-0 flex-1" aria-label="Bahan resep">
                <SelectValue>
                  {(value: string) => {
                    const ingredient = data.ingredients.find((item) => item.id === value);
                    return ingredient ? `${ingredient.name} (${ingredient.unit})` : "Pilih bahan";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {data.ingredients.map((ingredient) => (
                  <SelectItem value={ingredient.id} key={ingredient.id}>{ingredient.name} ({ingredient.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-28"
              type="number"
              step="any"
              min={0}
              aria-label="Jumlah bahan"
              placeholder="Jumlah"
              value={line.amount}
              onChange={(event) => updateLine(index, { amount: event.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Hapus baris resep"
              disabled={recipe.length === 1}
              onClick={() => setRecipe((lines) => lines.filter((_, lineIndex) => lineIndex !== index))}
            ><X /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" disabled={recipe.length >= 20} onClick={() => setRecipe((lines) => [...lines, { ingredientId: "", amount: "" }])}>
          <Plus data-icon="inline-start" /> Tambah bahan
        </Button>
      </div>
      <Button type="submit" className="w-full" disabled={pending}><Check data-icon="inline-start" /> Simpan menu</Button>
    </form>
  );
}

function IngredientForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (input: NewIngredientInput) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [minimum, setMinimum] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stock = Number(initialStock || 0);
    const minimumValue = Number(minimum || 0);
    if (name.trim().length < 2 || !unit.trim()) {
      toast.error("Nama dan satuan bahan wajib diisi.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(minimumValue) || minimumValue < 0) {
      toast.error("Stok awal dan batas minimum tidak boleh negatif.");
      return;
    }
    const result = await onCreate({ name: name.trim(), unit: unit.trim(), initialStock: stock, minimum: minimumValue });
    if (result !== null) {
      setName("");
      setUnit("");
      setInitialStock("");
      setMinimum("");
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <div className="flex flex-col gap-2">
        <Label>Nama bahan</Label>
        <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Susu full cream" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Satuan</Label>
        <Input value={unit} maxLength={12} onChange={(event) => setUnit(event.target.value)} placeholder="Contoh: ml, gram, pcs" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Stok awal</Label>
          <Input type="number" min={0} step="any" value={initialStock} onChange={(event) => setInitialStock(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Batas minimum</Label>
          <Input type="number" min={0} step="any" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending}><Plus data-icon="inline-start" /> Tambah bahan</Button>
    </form>
  );
}

const setupSteps = ["Profil toko", "Bahan baku", "Menu", "Denah meja", "Selesai"];

const shapeKindOptions: { kind: MapShapeKind; label: string; icon: LucideIcon }[] = [
  { kind: "rectangle", label: "Area", icon: Square },
  { kind: "ellipse", label: "Area bulat", icon: Circle },
  { kind: "wall", label: "Dinding", icon: Minus },
  { kind: "counter", label: "Counter", icon: Coffee },
];
const shapeKindLabels: Record<MapShapeKind, string> = {
  rectangle: "Area",
  ellipse: "Area bulat",
  wall: "Dinding",
  counter: "Counter",
};

function TableLayoutEditor({ tables, shapes, pending, runAction }: {
  tables: DiningTable[];
  shapes: MapShape[];
  pending: boolean;
  runAction: RunAction;
}) {
  const [selection, setSelection] = useState<MapSelection>(null);
  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteTable, setConfirmDeleteTable] = useState(false);
  const selectedTableId = selection?.type === "table" ? selection.id : null;
  const selected = tables.find((table) => table.id === selectedTableId) ?? null;
  const selectedShape = selection?.type === "shape" ? shapes.find((shape) => shape.id === selection.id) ?? null : null;
  const trimmedNewName = newName.trim();
  const trimmedRename = renameValue.trim();

  function selectTable(table: DiningTable) {
    setSelection({ type: "table", id: table.id });
    setRenameValue(table.name);
  }

  async function addShape(kind: MapShapeKind) {
    const result = await runAction(
      () => requestJson<{ ok: true; id: number }>("/api/map-shapes", "POST", { kind }),
      `${shapeKindLabels[kind]} ditambahkan.`,
    );
    if (result !== null) setSelection({ type: "shape", id: result.id });
  }

  async function changeShape(shape: MapShape, rect: ShapeRect) {
    const result = await runAction(
      () => requestJson(`/api/map-shapes/${shape.id}`, "PATCH", rect),
      "Ukuran area tersimpan.",
    );
    return result !== null;
  }

  async function addTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedNewName) return;
    const result = await runAction(
      () => requestJson("/api/tables", "POST", { name: trimmedNewName }),
      `Meja "${trimmedNewName}" ditambahkan.`,
    );
    if (result !== null) setNewName("");
  }

  async function renameTable() {
    if (!selected || !trimmedRename || trimmedRename === selected.name) return;
    await runAction(
      () => requestJson(`/api/tables/${selected.id}`, "PATCH", { name: trimmedRename }),
      "Nama meja diperbarui.",
    );
  }

  async function removeTable() {
    if (!selected) return;
    const result = await runAction(
      () => requestJson(`/api/tables/${selected.id}`, "DELETE"),
      "Meja dihapus.",
    );
    if (result !== null) setSelection(null);
  }

  function deleteTable() {
    if (selected) setConfirmDeleteTable(true);
  }

  function moveTable(table: DiningTable, x: number, y: number) {
    void runAction(
      () => requestJson(`/api/tables/${table.id}`, "PATCH", { x, y }),
      "Posisi meja tersimpan.",
    );
  }

  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
      <TableMap
        tables={tables}
        shapes={shapes}
        selection={selection}
        mode="admin"
        onSelectTable={selectTable}
        onSelectShape={(shape) => setSelection({ type: "shape", id: shape.id })}
        onClearSelection={() => setSelection(null)}
        onMoveTable={moveTable}
        onChangeShape={changeShape}
        className="table-map-admin"
      />
      {confirmDeleteTable && selected && (
        <ConfirmDialog
          title={`Hapus ${selected.name} dari denah?`}
          description="Meja ini akan dihapus dari denah."
          confirmLabel="Hapus meja"
          onClose={() => setConfirmDeleteTable(false)}
          onConfirm={() => {
            setConfirmDeleteTable(false);
            void removeTable();
          }}
        />
      )}
      <div className="flex flex-col gap-4">
        <form className="flex flex-col gap-2" onSubmit={addTable}>
          <Label>Tambah meja</Label>
          <div className="flex gap-2">
            <Input
              value={newName}
              maxLength={32}
              placeholder="Contoh: Meja 11 atau VIP 1"
              onChange={(event) => setNewName(event.target.value)}
            />
            <Button type="submit" disabled={pending || !trimmedNewName}><Plus data-icon="inline-start" /> Tambah</Button>
          </div>
        </form>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Tambah area ke denah</span>
          <div className="flex flex-wrap gap-2">
            {shapeKindOptions.map(({ kind, label, icon: Icon }) => (
              <Button key={kind} type="button" size="sm" variant="outline" disabled={pending} onClick={() => addShape(kind)}>
                <Icon data-icon="inline-start" /> {label}
              </Button>
            ))}
          </div>
        </div>
        {selectedShape ? (
          <ShapeInspector
            key={`${selectedShape.id}-${selectedShape.label}-${selectedShape.width}-${selectedShape.height}`}
            shape={selectedShape}
            pending={pending}
            runAction={runAction}
            onDeleted={() => setSelection(null)}
          />
        ) : selected ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{selected.name}</span>
                <Badge variant={selected.occupied ? "destructive" : "secondary"}>{selected.occupied ? "Terisi" : "Kosong"}</Badge>
              </CardTitle>
              {selected.occupied && (
                <CardDescription>
                  Meja terisi tidak bisa diganti nama atau dihapus. Pesanan terbuka: {selected.openOrderNumber}.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Label>Nama meja</Label>
              <Input
                value={renameValue}
                maxLength={32}
                disabled={selected.occupied}
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending || selected.occupied || !trimmedRename || trimmedRename === selected.name}
                onClick={renameTable}
              >
                Simpan nama
              </Button>
              <Button type="button" variant="destructive" disabled={pending || selected.occupied} onClick={deleteTable}>
                <Trash2 data-icon="inline-start" /> Hapus meja
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Pilih meja atau area di peta. Geser meja untuk mengatur posisinya; pilih area lalu geser sudutnya untuk mengubah ukuran.</p>
        )}
        <p className="text-sm text-muted-foreground">{tables.length} meja · {shapes.length} area di denah</p>
      </div>
    </div>
  );
}

function ShapeInspector({ shape, pending, runAction, onDeleted }: {
  shape: MapShape;
  pending: boolean;
  runAction: RunAction;
  onDeleted: () => void;
}) {
  const [label, setLabel] = useState(shape.label);
  const [width, setWidth] = useState(String(shape.width));
  const [height, setHeight] = useState(String(shape.height));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trimmedLabel = label.trim();
  const nextWidth = Number(width);
  const nextHeight = Number(height);
  const sizeValid = nextWidth >= 2 && nextWidth <= 100 && nextHeight >= 2 && nextHeight <= 100;
  const changed = trimmedLabel !== shape.label || nextWidth !== shape.width || nextHeight !== shape.height;

  async function saveShape() {
    if (!sizeValid || !changed) return;
    await runAction(
      () => requestJson(`/api/map-shapes/${shape.id}`, "PATCH", { label: trimmedLabel, width: nextWidth, height: nextHeight }),
      "Area tersimpan.",
    );
  }

  async function removeShape() {
    const result = await runAction(() => requestJson(`/api/map-shapes/${shape.id}`, "DELETE"), "Area dihapus.");
    if (result !== null) onDeleted();
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{shapeKindLabels[shape.kind]}</span>
        </CardTitle>
        <CardDescription>Area hanya untuk gambaran denah dan tidak memengaruhi pesanan.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Label (opsional)</Label>
          <Input
            value={label}
            maxLength={32}
            placeholder="Contoh: Area indoor"
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>Lebar</Label>
            <Input type="number" min={2} max={100} step="any" value={width} onChange={(event) => setWidth(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tinggi</Label>
            <Input type="number" min={2} max={100} step="any" value={height} onChange={(event) => setHeight(event.target.value)} />
          </div>
        </div>
        {!sizeValid && <p className="text-sm text-destructive">Lebar dan tinggi harus antara 2 dan 100.</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending || !sizeValid || !changed} onClick={saveShape}>
          Simpan area
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>
          <Trash2 data-icon="inline-start" /> Hapus area
        </Button>
      </CardFooter>
      {confirmDelete && (
        <ConfirmDialog
          title={`Hapus ${shapeKindLabels[shape.kind]} dari denah?`}
          description="Area ini akan dihapus dari denah."
          confirmLabel="Hapus area"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void removeShape();
          }}
        />
      )}
    </Card>
  );
}

function SetupWizard({ data, pending, runAction }: { data: PosBootstrap; pending: boolean; runAction: RunAction }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState(data.outletName);
  const [taxPercent, setTaxPercent] = useState(String(data.taxRateBasisPoints / 100));
  const [width, setWidth] = useState<58 | 80>(data.receiptWidthMm);
  const [footer, setFooter] = useState(data.receiptFooter);
  const trimmedName = storeName.trim();
  const activeProducts = data.products.filter((product) => product.active).length;

  async function uploadLogo(file: File) {
    const form = new FormData();
    form.append("logo", file);
    await runAction(() => requestJson("/api/settings/logo", "POST", form), "Logo toko diperbarui.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const basisPoints = taxPercentToBasisPoints(taxPercent);
    if (trimmedName.length < 3) {
      toast.error("Nama toko minimal 3 karakter.");
      return;
    }
    if (basisPoints === null) {
      toast.error("Pajak harus antara 0% dan 30%.");
      return;
    }
    const result = await runAction(
      () => requestJson("/api/settings", "PATCH", {
        outletName: trimmedName,
        taxRateBasisPoints: basisPoints,
        receiptWidthMm: width,
        receiptFooter: footer.trim(),
      }),
      "Profil toko tersimpan.",
    );
    if (result !== null) setStep(1);
  }

  async function finishSetup() {
    const result = await runAction(() => requestJson("/api/setup/complete", "POST"), "Setup awal selesai.");
    if (result !== null) {
      router.replace("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-6">
      <Toaster richColors position="top-right" />
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Coffee className="size-5" /></div>
        <div className="flex flex-col"><strong className="font-semibold">Kopi Senja</strong><span className="text-sm text-muted-foreground">SETUP AWAL OUTLET</span></div>
      </header>
      <ol className="grid grid-cols-5 gap-2 text-sm">
        {setupSteps.map((label, index) => (
          <li key={label} className={`flex flex-col items-center gap-1 text-center ${index === step ? "font-semibold text-primary" : index < step ? "text-foreground" : "text-muted-foreground"}`}>
            <span className={`flex size-7 items-center justify-center rounded-full border text-xs ${index === step ? "border-primary bg-primary text-primary-foreground" : index < step ? "border-primary text-primary" : ""}`}>{index < step ? <Check className="size-4" /> : index + 1}</span>{label}
          </li>
        ))}
      </ol>
      <Card className="gap-6 p-6">
        {step === 0 && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-widest text-primary">LANGKAH 1 DARI 5</span>
              <h1 className="text-4xl font-normal tracking-tight">Profil toko</h1>
              <p className="text-muted-foreground">Nama, logo, pajak, dan struk tampil di sidebar, nota, dan tiket cetak.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {data.outletLogoUrl ? <img className="size-full object-cover" src={data.outletLogoUrl} alt="Logo toko" /> : <Coffee className="size-6 text-muted-foreground" />}
              </div>
              <ImageUploadControls
                hasImage={data.outletLogoUrl !== null}
                uploadLabel="Unggah logo"
                disabled={pending}
                onUpload={uploadLogo}
                onRemove={() => runAction(() => requestJson("/api/settings/logo", "DELETE"), "Logo toko dihapus.")}
              />
            </div>
            <form className="flex flex-col gap-6" onSubmit={saveProfile}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Nama toko</Label>
                  <Input value={storeName} maxLength={60} onChange={(event) => setStoreName(event.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Pajak (%)</Label>
                  <Input type="number" min={0} max={30} step="0.01" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Lebar kertas struk</Label>
                  <Select value={String(width)} onValueChange={(next) => setWidth(Number(next ?? 80) as 58 | 80)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58">58 mm · compact</SelectItem>
                      <SelectItem value="80">80 mm · standar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Catatan kaki struk</Label>
                  <Input value={footer} maxLength={120} onChange={(event) => setFooter(event.target.value)} placeholder="Contoh: Terima kasih, sampai jumpa lagi!" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={pending || trimmedName.length < 3}>Simpan & lanjut <ArrowRight data-icon="inline-end" /></Button>
              </div>
            </form>
          </>
        )}
        {step === 1 && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-widest text-primary">LANGKAH 2 DARI 5</span>
              <h1 className="text-4xl font-normal tracking-tight">Bahan baku</h1>
              <p className="text-muted-foreground">Bahan dipakai sebagai resep menu. Minimal tambahkan satu bahan sebelum lanjut.</p>
            </div>
            <div className="flex flex-col divide-y rounded-lg border">
              {data.ingredients.map((ingredient) => (
                <div className="flex items-center justify-between gap-4 px-4 py-3" key={ingredient.id}>
                  <strong className="font-medium">{ingredient.name}</strong>
                  <span className="text-sm text-muted-foreground">{ingredient.onHand} {ingredient.unit} · minimum {ingredient.minimum} {ingredient.unit}</span>
                </div>
              ))}
              {data.ingredients.length === 0 && <EmptyState text="Belum ada bahan baku." />}
            </div>
            <IngredientForm
              pending={pending}
              onCreate={(input) => runAction(() => requestJson("/api/ingredients", "POST", input), "Bahan baku ditambahkan.")}
            />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)}>Kembali</Button>
              <Button type="button" onClick={() => setStep(2)} disabled={data.ingredients.length === 0}>Lanjut <ArrowRight data-icon="inline-end" /></Button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-widest text-primary">LANGKAH 3 DARI 5</span>
              <h1 className="text-4xl font-normal tracking-tight">Menu</h1>
              <p className="text-muted-foreground">Setiap menu wajib punya stasiun produksi dan resep bahan. Minimal satu menu aktif.</p>
            </div>
            <div className="flex flex-col divide-y rounded-lg border">
              {data.products.map((product) => (
                <div className="flex items-center justify-between gap-4 px-4 py-3" key={product.id}>
                  <strong className="font-medium">{product.icon} {product.name}</strong>
                  <span className="text-sm text-muted-foreground">{money(product.price)} · {product.station}</span>
                </div>
              ))}
              {data.products.length === 0 && <EmptyState text="Belum ada menu." />}
            </div>
            <ProductForm
              data={data}
              pending={pending}
              onCreate={(input) => runAction(() => requestJson("/api/products", "POST", input), "Menu ditambahkan.")}
            />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Kembali</Button>
              <Button type="button" onClick={() => setStep(3)} disabled={activeProducts === 0}>Lanjut <ArrowRight data-icon="inline-end" /></Button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-widest text-primary">LANGKAH 4 DARI 5</span>
              <h1 className="text-4xl font-normal tracking-tight">Denah meja</h1>
              <p className="text-muted-foreground">Tambahkan meja dan letakkan sesuai posisi di outlet. Kasir memilih meja dari denah ini. Langkah ini bisa dilewati jika outlet hanya melayani takeaway.</p>
            </div>
            <TableLayoutEditor tables={data.tables} shapes={data.mapShapes} pending={pending} runAction={runAction} />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>Kembali</Button>
              <Button type="button" onClick={() => setStep(4)}>Lanjut <ArrowRight data-icon="inline-end" /></Button>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-widest text-primary">LANGKAH 5 DARI 5</span>
              <h1 className="text-4xl font-normal tracking-tight">Selesai</h1>
              <p className="text-muted-foreground">Data ini langsung dipakai di kasir, pesanan, dan inventory setelah setup selesai.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { value: data.outletName, label: "Nama toko" },
                { value: data.ingredients.length, label: "Bahan baku" },
                { value: activeProducts, label: "Menu aktif" },
                { value: `${data.taxRateBasisPoints / 100}%`, label: "Pajak" },
                { value: data.tables.length, label: "Meja" },
              ].map((item) => (
                <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-4" key={item.label}>
                  <strong className="text-lg font-semibold">{item.value}</strong>
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>Kembali</Button>
              <Button type="button" onClick={finishSetup} disabled={pending || activeProducts === 0 || data.ingredients.length === 0}>
                Selesai & buka aplikasi <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      <Coffee className="size-5" />
      {text}
    </div>
  );
}

function PrintDialog({ order, data, onClose }: { order: Order; data: PosBootstrap; onClose: () => void }) {
  const receiptClass = data.receiptWidthMm === 58 ? "receipt-58" : "receipt-80";
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const bluetoothPrinter = useSyncExternalStore(subscribeBrowserPrinter, getBrowserPrinter, () => null);
  const bluetoothSupported = isBrowserBluetoothSupported();
  const serverPrintEnabled = data.printer.mode !== "off";
  async function printOnServer() {
    setSending(true);
    try {
      const result = await requestJson<{ ok: boolean; documents: number }>(`/api/orders/${order.id}/print`, "POST");
      toast.success(`${result.documents} dokumen dikirim ke printer.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencetak ke printer.");
    } finally {
      setSending(false);
    }
  }
  async function connectBluetooth() {
    setConnecting(true);
    try {
      const printer = await connectBrowserPrinter();
      if (printer) toast.success(`Terhubung ke ${printer.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal terhubung ke printer Bluetooth.");
    } finally {
      setConnecting(false);
    }
  }
  async function printOverBluetooth() {
    setSending(true);
    try {
      const result = await requestJson<{ documents: number; data: string }>(`/api/orders/${order.id}/escpos`, "GET");
      const bytes = Uint8Array.from(atob(result.data), (char) => char.charCodeAt(0));
      await printOverBrowserBluetooth(bytes);
      toast.success(`${result.documents} dokumen dikirim ke ${bluetoothPrinter?.name ?? "printer Bluetooth"}.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencetak ke printer Bluetooth.");
    } finally {
      setSending(false);
    }
  }
  const formatReceiptLine = (item: OrderItem) => (
    <div className="receipt-line" key={item.id}>
      <div><span>{item.quantity}× {item.name}</span><strong>{money(item.unitPrice * item.quantity)}</strong></div>
      {item.modifier && <small>{item.modifier}</small>}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl" role="dialog" aria-modal="true" aria-labelledby="print-title">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Printer size={19} /></div>
            <div>
              <h2 id="print-title" className="text-lg font-semibold">Dokumen transaksi</h2>
              <p className="text-sm text-muted-foreground">Nota pelanggan dan tiket produksi</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X /></Button>
        </div>
        <div className="print-documents flex-1 overflow-y-auto bg-muted/40 p-5">
          <div className={`receipt-paper ${receiptClass}`}>
            <ReceiptLogo src={data.outletLogoUrl} />
            <h3>{data.outletName}</h3>
            <p>POS · Bukti pembayaran simulasi</p>
            <div className="receipt-dash" />
            <div className="receipt-meta"><span>No. pesanan</span><strong>{order.orderNumber}</strong></div>
            <div className="receipt-meta"><span>Waktu</span><strong>{fullDate(order.createdAt)} {dateTime(order.createdAt)}</strong></div>
            <div className="receipt-meta"><span>Jenis</span><strong>{order.type}{order.table ? ` · ${order.table}` : ""}</strong></div>
            {order.customerName && <div className="receipt-meta"><span>Pelanggan</span><strong>{order.customerName}</strong></div>}
            <div className="receipt-dash" />
            {order.items.map(formatReceiptLine)}
            {order.note && <p className="receipt-note">Catatan: {order.note}</p>}
            <div className="receipt-dash" />
            <div className="receipt-meta"><span>Subtotal</span><span>{money(order.subtotal ?? 0)}</span></div>
            {(order.discountAmount ?? 0) > 0 && <div className="receipt-meta"><span>Diskon {order.discountName ?? ""}</span><span>-{money(order.discountAmount ?? 0)}</span></div>}
            <div className="receipt-meta"><span>Pajak</span><span>{money(order.tax ?? 0)}</span></div>
            <div className="receipt-meta receipt-total"><strong>TOTAL</strong><strong>{money(order.total ?? 0)}</strong></div>
            <div className="receipt-meta"><span>Pembayaran</span><strong>{order.paymentMethod ?? "-"}</strong></div>
            {order.cashReceived !== null && <div className="receipt-meta"><span>Tunai / kembalian</span><span>{money(order.cashReceived)} / {money(order.changeAmount ?? 0)}</span></div>}
            <div className="receipt-dash" />
            <p className="receipt-footer">{data.receiptFooter}</p>
            <p className="receipt-ref">Ref. {order.paymentReference ?? "-"}</p>
          </div>
          {order.tickets.map((ticket) => (
            <div className={`receipt-paper print-ticket ${receiptClass}`} key={ticket.id}>
              <div className="ticket-print-label">{ticket.station === "Kitchen" ? "🍳" : "☕"} TIKET {ticket.station.toUpperCase()}</div>
              <h3>{data.outletName}</h3>
              <div className="receipt-dash" />
              <div className="receipt-meta"><span>Pesanan</span><strong>{order.orderNumber}</strong></div>
              <div className="receipt-meta"><span>Waktu</span><strong>{dateTime(order.createdAt)}</strong></div>
              <div className="receipt-meta"><span>Jenis</span><strong>{order.type}{order.table ? ` · ${order.table}` : ""}</strong></div>
              {order.customerName && <div className="receipt-meta"><span>Pelanggan</span><strong>{order.customerName}</strong></div>}
              <div className="receipt-dash" />
              {ticket.items.map((item) => (
                <div className="ticket-print-item" key={item.id}>
                  <strong>{item.quantity}× {item.name}</strong>
                  {item.modifier && <span>{item.modifier}</span>}
                </div>
              ))}
              {order.note && <p className="receipt-note">Catatan: {order.note}</p>}
              <div className="receipt-dash" />
              <p className="ticket-print-footer">Tiket produksi · {ticket.station}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-4">
          <span className="flex items-center gap-2 text-sm" data-connected={bluetoothPrinter ? "true" : "false"}>
            {bluetoothPrinter ? <BluetoothConnected size={16} className="text-primary" /> : <Bluetooth size={16} className="text-muted-foreground" />}
            {bluetoothPrinter ? `Terhubung ke ${bluetoothPrinter.name}` : bluetoothSupported ? "Printer thermal Bluetooth belum terhubung" : "Browser ini tidak mendukung Bluetooth (pakai Chrome atau Edge)"}
          </span>
          {bluetoothSupported && (bluetoothPrinter ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={disconnectBrowserPrinter} disabled={sending}>Putuskan</Button>
              <Button onClick={printOverBluetooth} disabled={sending}><Printer data-icon="inline-start" /> {sending ? "Mengirim..." : "Cetak ke Bluetooth"}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={connectBluetooth} disabled={connecting || sending}>
              <Bluetooth data-icon="inline-start" /> {connecting ? "Menghubungkan..." : "Connect ke printer thermal"}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Printer size={14} /> {serverPrintEnabled ? "Cetak ke printer thermal dikirim dari server. Cetak lewat browser tersedia sebagai cadangan." : "Satu aksi akan mencetak nota dan semua tiket stasiun."}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {serverPrintEnabled ? (
              <>
                <Button variant="outline" onClick={() => window.print()} disabled={sending}>Cetak lewat browser</Button>
                <Button onClick={printOnServer} disabled={sending}><Printer data-icon="inline-start" /> {sending ? "Mengirim..." : "Cetak ke printer"}</Button>
              </>
            ) : (
              <Button onClick={() => window.print()}><Printer data-icon="inline-start" /> Cetak semua dokumen</Button>
            )}
          </div>
        </div>
      </div>
      <div id="print-area" className="print-area">
        <div className={`receipt-paper ${receiptClass}`}>
          <ReceiptLogo src={data.outletLogoUrl} /><h3>{data.outletName}</h3><p>POS · Bukti pembayaran simulasi</p>
          <div className="receipt-dash" />
          <div className="receipt-meta"><span>No. pesanan</span><strong>{order.orderNumber}</strong></div>
          <div className="receipt-meta"><span>Waktu</span><strong>{fullDate(order.createdAt)} {dateTime(order.createdAt)}</strong></div>
          <div className="receipt-meta"><span>Jenis</span><strong>{order.type}{order.table ? ` · ${order.table}` : ""}</strong></div>
          {order.customerName && <div className="receipt-meta"><span>Pelanggan</span><strong>{order.customerName}</strong></div>}
          <div className="receipt-dash" />
          {order.items.map(formatReceiptLine)}
          {order.note && <p className="receipt-note">Catatan: {order.note}</p>}
          <div className="receipt-dash" />
          <div className="receipt-meta"><span>Subtotal</span><span>{money(order.subtotal ?? 0)}</span></div>
          {(order.discountAmount ?? 0) > 0 && <div className="receipt-meta"><span>Diskon {order.discountName ?? ""}</span><span>-{money(order.discountAmount ?? 0)}</span></div>}
          <div className="receipt-meta"><span>Pajak</span><span>{money(order.tax ?? 0)}</span></div>
          <div className="receipt-meta receipt-total"><strong>TOTAL</strong><strong>{money(order.total ?? 0)}</strong></div>
          <div className="receipt-meta"><span>Pembayaran</span><strong>{order.paymentMethod ?? "-"}</strong></div>
          {order.cashReceived !== null && <div className="receipt-meta"><span>Tunai / kembalian</span><span>{money(order.cashReceived)} / {money(order.changeAmount ?? 0)}</span></div>}
          <div className="receipt-dash" /><p className="receipt-footer">{data.receiptFooter}</p>
          <p className="receipt-ref">Ref. {order.paymentReference ?? "-"}</p>
        </div>
        {order.tickets.map((ticket) => (
          <div className={`receipt-paper print-ticket ${receiptClass}`} key={`print-${ticket.id}`}>
            <div className="ticket-print-label">{ticket.station === "Kitchen" ? "🍳" : "☕"} TIKET {ticket.station.toUpperCase()}</div>
            <h3>{data.outletName}</h3><div className="receipt-dash" />
            <div className="receipt-meta"><span>Pesanan</span><strong>{order.orderNumber}</strong></div>
            <div className="receipt-meta"><span>Waktu</span><strong>{dateTime(order.createdAt)}</strong></div>
            <div className="receipt-meta"><span>Jenis</span><strong>{order.type}{order.table ? ` · ${order.table}` : ""}</strong></div>
            {order.customerName && <div className="receipt-meta"><span>Pelanggan</span><strong>{order.customerName}</strong></div>}
            <div className="receipt-dash" />
            {ticket.items.map((item) => <div className="ticket-print-item" key={item.id}><strong>{item.quantity}× {item.name}</strong>{item.modifier && <span>{item.modifier}</span>}</div>)}
            {order.note && <p className="receipt-note">Catatan: {order.note}</p>}
            <div className="receipt-dash" /><p className="ticket-print-footer">Tiket produksi · {ticket.station}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
