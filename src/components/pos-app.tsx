"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  BellOff,
  Bluetooth,
  BluetoothConnected,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock3,
  Coffee,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { TableMap, type MapSelection, type ShapeRect } from "@/components/table-map";
import {
  enableQueueAlarmSound,
  formatQueueElapsed,
  getQueueLevel,
  isQueueTimedStatus,
  playQueueAlarmBeep,
  QUEUE_ALARM_REPEAT_MS,
  type QueueLevel,
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
  PosBootstrap,
  Product,
  StationTicket,
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
  | { action: "cancel"; reason: string };
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
  Queued: "status-queued",
  Preparing: "status-preparing",
  "Ready for pickup": "status-ready",
  Completed: "status-completed",
  Cancelled: "status-cancelled",
};
const orderStatusLabels: Record<Order["status"], string> = {
  Queued: "Antrean",
  Preparing: "Diproses",
  "Ready for pickup": "Siap diambil",
  Completed: "Selesai",
  Cancelled: "Dibatalkan",
};
const columns: { status: Order["status"]; label: string; tone: string }[] = [
  { status: "Queued", label: "Antrean", tone: "kanban-queued" },
  { status: "Preparing", label: "Sedang diproses", tone: "kanban-preparing" },
  { status: "Ready for pickup", label: "Siap diambil", tone: "kanban-ready" },
  { status: "Completed", label: "Selesai", tone: "kanban-completed" },
  { status: "Cancelled", label: "Dibatalkan", tone: "kanban-cancelled" },
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
    <div className="section-title-row">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
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
    <Card className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </Card>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  return <Badge className={`order-status ${orderStatusStyles[status]}`}>{orderStatusLabels[status]}</Badge>;
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  async function refresh() {
    const updated = await requestJson<PosBootstrap>("/api/bootstrap", "GET", undefined, () => router.replace("/login"));
    setData(updated);
    return updated;
  }

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
      action.action === "pickup" ? "Pickup pesanan diselesaikan." : "Status pesanan diperbarui.",
    );
    return response?.order ?? null;
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
    <div className="pos-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon"><Coffee size={21} /></div>
          <div><strong>Kopi Senja</strong><span>POINT OF SALE</span></div>
          <button className="mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Tutup menu"><X size={18} /></button>
        </div>
        <div className="outlet-switcher">
          <Avatar src={data.outletLogoUrl} name={data.outletName} className="outlet-avatar" />
          <div><strong>{data.outletName}</strong><span>Outlet aktif</span></div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">MENU UTAMA</div>
        <nav className="main-nav" aria-label="Navigasi utama">
          {sections.map(({ id, label, icon: Icon }) => {
            const isStationRole = user.role === "barista" || user.role === "kitchen";
            const href = id === "pesanan" && isStationRole ? defaultPathForRole(user.role) : appPath({ section: id });
            return (
              <Link
                key={id}
                href={href}
                prefetch={false}
                className={`nav-link ${section === id ? "nav-link-active" : ""}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {id === "pesanan" && activeOrders > 0 && <span className="nav-counter">{activeOrders}</span>}
              </Link>
            );
          })}
        </nav>
        {user.role === "admin" && data.summary.lowStockCount > 0 && (
          <div className="sidebar-alert">
            <AlertTriangle size={17} />
            <div><strong>Stok perlu dicek</strong><span>{data.summary.lowStockCount} bahan di batas minimum</span></div>
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-help"><Sparkles size={17} /><span>POS lokal siap melayani<br />operasional outlet.</span></div>
          <div className="user-card">
            <Avatar src={data.userAvatarUrl} name={user.name} className="user-avatar" />
            <div className="user-info"><strong>{user.name}</strong><span>{roleLabels[user.role]}</span></div>
            <button className="logout-button" onClick={logout} disabled={pending} title="Keluar"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Buka menu"><span></span><span></span><span></span></button>
          <div className="breadcrumb"><span>Operasional</span><span>/</span><strong>{activeLabel}</strong></div>
          <div className="topbar-right">
            <span className="topbar-date">{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
            <div className="online-indicator"><span className="live-dot" /> Lokal</div>
            <Avatar src={data.userAvatarUrl} name={user.name} className="topbar-user" />
          </div>
        </header>

        <main className="workspace">
          {section === "dashboard" && <Dashboard data={data} onNavigate={(target) => router.push(appPath({ section: target }))} />}
          {section === "kasir" && (
            <Cashier
              data={data}
              pending={pending}
              onPrint={setPrintOrder}
              onRefresh={refresh}
            />
          )}
          {section === "pesanan" && (
            <OrdersBoard
              data={data}
              pending={pending}
              station={station}
              onAction={orderAction}
              onCancel={async (order) => {
                const reason = window.prompt(`Alasan pembatalan ${order.orderNumber}:`);
                if (!reason?.trim()) return;
                await orderAction(order.id, { action: "cancel", reason: reason.trim() });
              }}
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
      </div>

      <Toaster richColors position="top-right" />
      {printOrder && (
        <PrintDialog
          order={printOrder}
          data={data}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}

function Dashboard({ data, onNavigate }: { data: PosBootstrap; onNavigate: (section: AppSection) => void }) {
  const summary = data.summary;
  const maxDaily = Math.max(1, ...summary.dailySales.map((sale) => sale.total));
  const recentOrders = data.orders.slice(0, 5);
  const lowIngredients = data.ingredients
    .filter((ingredient) => ingredient.onHand - ingredient.reserved <= ingredient.minimum)
    .slice(0, 4);

  return (
    <div className="screen-stack">
      <SectionTitle
        eyebrow="RINGKASAN OUTLET"
        title="Dashboard"
        action={<Button onClick={() => onNavigate("kasir")}><Plus size={16} /> Transaksi baru</Button>}
      />
      <div className="welcome-strip">
        <div>
          <span className="welcome-kicker">HARI INI DI {data.outletName.toUpperCase()}</span>
          <h2>Selamat bekerja, operasional berjalan lancar.</h2>
          <p>Pesanan aktif dan ringkasan penjualan outlet Anda.</p>
        </div>
        <div className="welcome-graphic"><Coffee size={75} strokeWidth={1.1} /><span>☀</span></div>
      </div>
      <div className="metric-grid">
        <MetricCard icon={Wallet} label="Penjualan hari ini" value={money(summary.todaySales)} note={`${summary.todayOrders} transaksi terbayar`} tone="metric-green" />
        <MetricCard icon={ClipboardList} label="Pesanan aktif" value={String(summary.activeOrders)} note="Menunggu atau sedang dibuat" tone="metric-blue" />
        <MetricCard icon={PackageCheck} label="Bahan perlu dicek" value={String(summary.lowStockCount)} note={summary.lowStockCount ? "Di bawah batas minimum" : "Semua stok aman"} tone="metric-orange" />
      </div>
      <div className="dashboard-grid">
        <Card className="panel sales-panel">
          <div className="panel-heading">
            <div><h2>Penjualan 7 hari</h2><p>Ringkasan pendapatan harian</p></div>
            <Badge variant="secondary">Minggu ini</Badge>
          </div>
          <div className="sales-total">{money(summary.dailySales.reduce((sum, item) => sum + item.total, 0))}<span>Total 7 hari terakhir</span></div>
          <div className="sales-chart" role="img" aria-label="Grafik penjualan tujuh hari terakhir">
            {summary.dailySales.map((sale) => (
              <div className="chart-column" key={sale.date}>
                <span className="chart-tooltip">{sale.total ? money(sale.total) : "Belum ada transaksi"}</span>
                <div className="chart-bar-track"><div className="chart-bar" style={{ height: `${Math.max(4, sale.total / maxDaily * 100)}%` }} /></div>
                <span className="chart-label">{sale.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="panel best-sellers-panel">
          <div className="panel-heading"><div><h2>Menu terlaris</h2><p>Paling banyak dipesan hari ini</p></div><Coffee size={18} className="muted-icon" /></div>
          {summary.topProducts.length === 0 ? <EmptyState text="Belum ada penjualan hari ini." /> : (
            <div className="best-seller-list">
              {summary.topProducts.slice(0, 4).map((product, index) => (
                <div className="best-seller" key={product.name}>
                  <span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
                  <div className="best-seller-name"><strong>{product.name}</strong><span>{product.quantity} item terjual</span></div>
                  <ArrowUpRight size={16} className="muted-icon" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="dashboard-grid lower-grid">
        <Card className="panel">
          <div className="panel-heading"><div><h2>Pesanan terbaru</h2><p>Aktivitas transaksi outlet</p></div><button className="text-link" onClick={() => onNavigate("pesanan")}>Lihat semua <ArrowRight size={14} /></button></div>
          <div className="recent-list">
            {recentOrders.length === 0 ? <EmptyState text="Belum ada transaksi." /> : recentOrders.map((order) => (
              <div className="recent-row" key={order.id}>
                <div className="recent-order-mark"><ShoppingCart size={16} /></div>
                <div className="recent-order-name"><strong>{order.orderNumber}</strong><span>{order.type}{order.table ? ` · ${order.table}` : ""} · {dateTime(order.createdAt)}</span></div>
                <StatusBadge status={order.status} />
                <strong className="recent-total">{money(order.total ?? 0)}</strong>
              </div>
            ))}
          </div>
        </Card>
        {data.user.role === "admin" && (
          <Card className="panel low-stock-panel">
            <div className="panel-heading"><div><h2>Perhatian stok</h2><p>Stok tersedia dibanding batas minimum</p></div><AlertTriangle size={18} className="warning-icon" /></div>
            {lowIngredients.length === 0 ? <EmptyState text="Semua bahan baku berada di batas aman." /> : lowIngredients.map((ingredient) => (
              <div className="stock-alert-row" key={ingredient.id}>
                <div className="stock-alert-dot"><AlertTriangle size={15} /></div>
                <div><strong>{ingredient.name}</strong><span>{ingredient.onHand - ingredient.reserved} {ingredient.unit} tersedia · minimum {ingredient.minimum}</span></div>
                <span className="stock-low-tag">Rendah</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

type PaymentMethod = "Cash" | "QRIS" | "Debit/Kredit";
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
    <div className="screen-stack cashier-screen">
      <SectionTitle
        eyebrow="POINT OF SALE"
        title="Kasir"
        action={<button className="ghost-action" onClick={() => setOrderHistoryOpen((open) => !open)}><Clock3 size={16} /> Riwayat hari ini</button>}
      />
      {orderHistoryOpen && (
        <Card className="panel history-panel">
          <div className="panel-heading"><div><h2>Riwayat transaksi terbaru</h2><p>Pilih cetak untuk membuka kembali nota dan tiket</p></div><button className="close-plain" onClick={() => setOrderHistoryOpen(false)}><X size={18} /></button></div>
          {data.orders.slice(0, 8).map((order) => (
            <div className="history-row" key={order.id}>
              <div><strong>{order.orderNumber}</strong><span>{dateTime(order.createdAt)} · {order.paymentMethod ?? "Pembayaran"}</span></div>
              <StatusBadge status={order.status} />
              <strong>{money(order.total ?? 0)}</strong>
              <button className="icon-action" onClick={() => onPrint(order)} title="Cetak ulang"><Printer size={16} /></button>
            </div>
          ))}
        </Card>
      )}
      <div className="cashier-layout">
        <section className="menu-catalog">
          <div className="catalog-toolbar">
            <div className="search-field"><Search size={17} /><Input placeholder="Cari menu..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <div className="category-pills">
              {categories.map((item) => <button key={item} className={category === item ? "category-pill category-pill-active" : "category-pill"} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <button className="product-card" key={product.id} onClick={() => addProduct(product)}>
                <span className={`product-art product-art-${product.category === "Makanan" ? "food" : "drink"}`}>{product.icon || "☕"}</span>
                {product.note && <span className="product-note">{product.note}</span>}
                <strong>{product.name}</strong>
                <span className="product-category">{product.category}</span>
                <span className="product-price">{money(product.price)} <span className="product-add"><Plus size={15} /></span></span>
              </button>
            ))}
            {products.length === 0 && <div className="empty-products"><Coffee size={28} /><strong>Menu tidak ditemukan</strong><span>Coba kata kunci atau kategori lain.</span></div>}
          </div>
        </section>

        <Card className="cart-panel">
          <div className="cart-heading">
            <div><div className="cart-title"><ShoppingCart size={18} /><h2>Pesanan baru</h2></div><p>{cart.reduce((sum, item) => sum + item.quantity, 0)} item dalam keranjang</p></div>
            {cart.length > 0 && <button className="clear-cart" onClick={() => setCart([])} title="Kosongkan pesanan"><Trash2 size={16} /></button>}
          </div>
          <div className="order-type-switch">
            {(["Dine-in", "Takeaway"] as const).map((type) => <button key={type} className={orderType === type ? "type-option type-option-active" : "type-option"} onClick={() => setOrderType(type)}>{type === "Dine-in" ? "Makan di tempat" : "Bungkus"}</button>)}
          </div>
          {orderType === "Dine-in" && (
            <div className="cashier-table-picker">
              <div className="table-picker-heading">
                <span>Pilih meja</span>
                {selectedTable && <strong>{selectedTable.name}</strong>}
              </div>
              {data.tables.length === 0 ? (
                <div className="table-empty-state">
                  <strong>Belum ada meja</strong>
                  <span>
                    {data.user.role === "admin"
                      ? "Tambahkan denah meja di Pengaturan terlebih dahulu."
                      : "Minta admin menambahkan denah meja di Pengaturan."}
                  </span>
                  {data.user.role === "admin" && (
                    <Link className="table-empty-link" href={appPath({ section: "pengaturan" })}>Buka Pengaturan</Link>
                  )}
                </div>
              ) : (
                <>
                  <TableMap
                    tables={data.tables}
                    shapes={data.mapShapes}
                    selection={tableId === null ? null : { type: "table", id: tableId }}
                    mode="kasir"
                    onSelectTable={(picked) => setTableId(picked.id)}
                    className="table-map-cashier"
                  />
                  {!selectedTable && <p className="table-picker-hint">Klik meja di denah untuk memilihnya.</p>}
                  {selectedTable?.occupied && (
                    <p className="table-picker-hint">Meja ini sedang terisi. Pesanan tambahan tetap bisa dibuat.</p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty"><div><ShoppingCart size={23} /></div><strong>Belum ada pesanan</strong><span>Pilih menu untuk mulai transaksi.</span></div>
            ) : cart.map((item) => {
              const product = data.products.find((candidate) => candidate.id === item.productId);
              return (
                <div className="cart-line" key={item.key}>
                  <div className="cart-line-icon">{item.icon || "☕"}</div>
                  <div className="cart-line-main">
                    <strong>{item.name}</strong>
                    <select
                      aria-label={`Pilihan ${item.name}`}
                      value={item.modifier}
                      className="modifier-select"
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
                    <span className="cart-unit-price">{money(item.price)}</span>
                  </div>
                  <div className="quantity-control">
                    <button onClick={() => changeQuantity(item.key, -1)} aria-label={`Kurangi ${item.name}`}><Minus size={13} /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => changeQuantity(item.key, 1)} aria-label={`Tambah ${item.name}`}><Plus size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cart-checkout">
            <label className="field-label">Catatan pesanan <Input placeholder="Contoh: saus dipisah" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            <div className="checkout-totals">
              <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {discountAmount > 0 && <div><span>Diskon ({appliedDiscount?.name})</span><span>-{money(discountAmount)}</span></div>}
              <div><span>Pajak ({(data.taxRateBasisPoints / 100).toLocaleString("id-ID")}%)</span><span>{money(tax)}</span></div>
              <div className="checkout-grand-total"><strong>Total</strong><strong>{money(total)}</strong></div>
            </div>
            <Button
              className="checkout-button"
              disabled={saving || pending || cart.length === 0 || (orderType === "Dine-in" && !selectedTable)}
              onClick={() => setCheckoutOpen(true)}
            >
              Lanjut ke pembayaran <ArrowRight size={17} />
            </Button>
          </div>
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
    </div>
  );
}

const PAYMENT_OPTIONS: { method: PaymentMethod; icon: typeof Wallet; hint: string }[] = [
  { method: "Cash", icon: Wallet, hint: "Terima uang tunai dan hitung kembalian" },
  { method: "QRIS", icon: QrCode, hint: "Pelanggan memindai QRIS di layar terminal" },
  { method: "Debit/Kredit", icon: CreditCard, hint: "Pembayaran kartu lewat mesin EDC" },
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
  const cashShort = isCash && cashReceived < total;
  const cashBlocked = isCash && !cashShiftOpen;
  const canContinue = !(step === 0 && trimmedCustomerName === "") && !(step === 3 && (cashShort || cashBlocked));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isLastStep = step === CHECKOUT_STEP_LABELS.length - 1;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || (isLastStep && cashBlocked)) return;
    if (!isLastStep) {
      if (canContinue) setStep(step + 1);
      return;
    }
    await onSubmit({ customerName: trimmedCustomerName, method, cashReceived: isCash ? cashReceived : null });
  }

  return (
    <div className="checkout-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <form className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onSubmit={handleSubmit}>
        <div className="checkout-header">
          <div>
            <div className="checkout-icon"><Wallet size={20} /></div>
            <div>
              <h2 id="checkout-title">Pembayaran</h2>
              <p>{itemCount} item · {orderType === "Dine-in" ? table : "Bungkus"}</p>
            </div>
          </div>
          <button type="button" className="close-plain" onClick={onClose} disabled={saving} aria-label="Tutup"><X size={20} /></button>
        </div>
        <ol className="checkout-steps" aria-label="Langkah pembayaran">
          {CHECKOUT_STEP_LABELS.map((label, index) => (
            <li
              key={label}
              className={index === step ? "checkout-step checkout-step-active" : index < step ? "checkout-step checkout-step-done" : "checkout-step"}
              aria-current={index === step ? "step" : undefined}
            >
              <span className="checkout-step-number">{index < step ? <Check size={14} /> : index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <div className="checkout-body">
          {step === 0 && (
            <>
              <h3>Nama pelanggan</h3>
              <label className="field-label">Nama pelanggan
                <Input
                  className="checkout-cash-input"
                  list={customerListId}
                  placeholder="Ketik atau pilih nama pelanggan"
                  maxLength={60}
                  autoComplete="off"
                  autoFocus
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </label>
              <datalist id={customerListId}>
                {customers.map((customer) => (
                  <option key={customer.name} value={customer.name} label={`${customer.orderCount}× pesan`} />
                ))}
              </datalist>
              {frequentCustomers.length > 0 && (
                <>
                  <p className="checkout-instruction">Pelanggan yang sering memesan</p>
                  <div className="checkout-chips">
                    {frequentCustomers.map((customer) => (
                      <button
                        type="button"
                        key={customer.name}
                        className={trimmedCustomerName === customer.name ? "checkout-chip checkout-chip-active" : "checkout-chip"}
                        aria-pressed={trimmedCustomerName === customer.name}
                        onClick={() => setCustomerName(customer.name)}
                      >
                        {customer.name} · {customer.orderCount}×
                      </button>
                    ))}
                  </div>
                </>
              )}
              {trimmedCustomerName === "" && <p className="checkout-instruction">Nama pelanggan wajib diisi sebelum lanjut.</p>}
            </>
          )}
          {step === 1 && (
            <>
              <h3>Pilih diskon</h3>
              <p className="checkout-instruction">Diskon diterapkan sebelum pajak. Kosongkan jika tidak ada diskon.</p>
              <div className="checkout-chips">
                <button
                  type="button"
                  className={appliedDiscount === null ? "checkout-chip checkout-chip-active" : "checkout-chip"}
                  aria-pressed={appliedDiscount === null}
                  onClick={() => onSelectDiscount(null)}
                >
                  Tanpa diskon
                </button>
                {discounts.map((discount) => {
                  const eligible = subtotal >= discount.minSubtotal;
                  const isActive = appliedDiscount?.id === discount.id;
                  return (
                    <button
                      type="button"
                      key={discount.id}
                      className={isActive ? "checkout-chip checkout-chip-active" : "checkout-chip"}
                      aria-pressed={isActive}
                      disabled={!eligible}
                      onClick={() => onSelectDiscount(discount.id)}
                    >
                      {discount.name} · {discount.kind === "Percent" ? `${discount.value}%` : money(discount.value)}
                      {!eligible && <span> (min. {money(discount.minSubtotal)})</span>}
                    </button>
                  );
                })}
              </div>
              {discounts.length === 0 && <p className="checkout-instruction">Belum ada diskon aktif. Admin dapat menambahkannya di menu Menu.</p>}
              {appliedDiscount && (
                <div className="checkout-change"><span>Potongan {appliedDiscount.name}</span><strong>-{money(discountAmount)}</strong></div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h3>Pilih metode pembayaran</h3>
              <div className="checkout-method-grid">
                {PAYMENT_OPTIONS.map(({ method: option, icon: Icon, hint }) => (
                  <button
                    type="button"
                    key={option}
                    className={method === option ? "checkout-method checkout-method-active" : "checkout-method"}
                    aria-pressed={method === option}
                    onClick={() => setMethod(option)}
                  >
                    <Icon size={22} />
                    <strong>{option}</strong>
                    <span>{hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h3>{isCash ? "Uang diterima" : `Pembayaran ${method}`}</h3>
              <div className="checkout-amount-due"><span>Total tagihan</span><strong>{money(total)}</strong></div>
              {cashBlocked && <p className="checkout-warning">Shift kas belum dibuka. Buka shift di menu Kas, atau pilih metode non-tunai.</p>}
              {isCash ? (
                <>
                  <label className="field-label">Nominal uang tunai
                    <Input
                      className="checkout-cash-input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="Masukkan nominal"
                      autoFocus
                      value={cashInput}
                      onChange={(event) => setCashInput(event.target.value)}
                    />
                  </label>
                  <div className="checkout-chips">
                    <button type="button" className="checkout-chip" onClick={() => setCashInput(String(total))}>Uang pas</button>
                    {CASH_QUICK_AMOUNTS.map((amount) => (
                      <button type="button" key={amount} className="checkout-chip" onClick={() => setCashInput(String(amount))}>{money(amount)}</button>
                    ))}
                  </div>
                  {cashShort && cashInput !== "" && <p className="checkout-warning">Uang kurang {money(total - cashReceived)}</p>}
                  {!cashShort && <div className="checkout-change"><span>Kembalian</span><strong>{money(cashReceived - total)}</strong></div>}
                </>
              ) : (
                <p className="checkout-instruction">
                  {method === "QRIS"
                    ? "Minta pelanggan memindai QRIS di layar terminal, lalu pastikan pembayaran berhasil sebelum lanjut."
                    : "Minta pelanggan menyelesaikan pembayaran di mesin EDC, lalu pastikan transaksi berhasil sebelum lanjut."}
                </p>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <h3>Konfirmasi pesanan</h3>
              <div className="checkout-summary">
                <div><span>Pelanggan</span><strong>{trimmedCustomerName}</strong></div>
                <div><span>Tipe</span><strong>{orderType === "Dine-in" ? "Makan di tempat" : "Bungkus"}</strong></div>
                {orderType === "Dine-in" && <div><span>Meja</span><strong>{table}</strong></div>}
                <div><span>Metode</span><strong>{method}</strong></div>
                {isCash && <div><span>Uang diterima</span><strong>{money(cashReceived)}</strong></div>}
                {isCash && <div><span>Kembalian</span><strong>{money(cashReceived - total)}</strong></div>}
              </div>
              <div className="checkout-items">
                {items.map((item) => (
                  <div key={item.key}>
                    <span>{item.quantity}× {item.name}{item.modifier ? ` (${item.modifier})` : ""}</span>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              <div className="checkout-totals">
                <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
                {appliedDiscount && <div><span>Diskon ({appliedDiscount.name})</span><span>-{money(discountAmount)}</span></div>}
                <div><span>Pajak ({taxRateLabel}%)</span><span>{money(tax)}</span></div>
                <div className="checkout-grand-total"><strong>Total</strong><strong>{money(total)}</strong></div>
              </div>
              <p className="payment-note"><Check size={13} /> Pembayaran simulasi · reservasi stok otomatis</p>
            </>
          )}
        </div>
        <div className="checkout-footer">
          {step === 0 ? (
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>Kembali</Button>
          )}
          {isLastStep ? (
            <Button type="submit" disabled={saving || cashBlocked}>
              {saving ? "Memproses pembayaran..." : "Bayar & buat pesanan"} <Check size={16} />
            </Button>
          ) : (
            <Button type="submit" disabled={!canContinue}>Lanjut <ArrowRight size={16} /></Button>
          )}
        </div>
      </form>
    </div>
  );
}

function OrdersBoard({
  data,
  pending,
  station,
  onAction,
  onCancel,
  onPrint,
}: {
  data: PosBootstrap;
  pending: boolean;
  station?: StationSlug;
  onAction: (id: string, action: OrderAction) => Promise<Order | null>;
  onCancel: (order: Order) => void;
  onPrint: (order: Order) => void;
}) {
  const stationRole = data.user.role === "barista" ? "Barista" : data.user.role === "kitchen" ? "Kitchen" : null;
  const filter: "Semua" | "Kitchen" | "Barista" = stationRole ?? (station ? stationLabels[station] : "Semua");
  const visibleOrders = data.orders.filter((order) => filter === "Semua" || order.tickets.some((ticket) => ticket.station === filter));
  const canPrint = data.user.role === "admin" || data.user.role === "cashier";
  const canPickup = canPrint;
  const canCancel = data.user.role === "admin";
  const boardTone = filter === "Barista" ? "station-board-barista" : filter === "Kitchen" ? "station-board-kitchen" : "";
  const hasTimedOrders = visibleOrders.some((order) => isQueueTimedStatus(order.status));
  const now = useQueueClock(hasTimedOrders);
  const hasAlarm = now !== null && visibleOrders.some((order) =>
    isQueueTimedStatus(order.status) && getQueueLevel(order.createdAt, now) === "alarm");
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    if (!hasAlarm || !soundEnabled) return;
    playQueueAlarmBeep();
    const intervalId = window.setInterval(playQueueAlarmBeep, QUEUE_ALARM_REPEAT_MS);
    return () => window.clearInterval(intervalId);
  }, [hasAlarm, soundEnabled]);

  async function toggleAlarmSound() {
    if (soundEnabled) {
      setSoundEnabled(false);
      return;
    }
    if (await enableQueueAlarmSound()) {
      setSoundEnabled(true);
    } else {
      toast.error("Browser belum mengizinkan suara. Klik tombol suara alarm sekali lagi.");
    }
  }
  const stationTabs: { label: string; value: "Semua" | "Kitchen" | "Barista"; href: string }[] = [
    { label: "Semua", value: "Semua", href: "/pesanan" },
    { label: "Barista", value: "Barista", href: "/pesanan/barista" },
    { label: "Kitchen", value: "Kitchen", href: "/pesanan/kitchen" },
  ];

  return (
    <div className={`screen-stack kanban-screen ${boardTone}`}>
      <SectionTitle
        eyebrow="PRODUKSI & PICKUP"
        title={filter === "Semua" ? "Pesanan" : `Pesanan ${filter}`}
        action={!stationRole && <div className="station-filters">
          {stationTabs.map((tab) => (
            <Link key={tab.value} href={tab.href} prefetch={false} className={filter === tab.value ? "station-filter station-filter-active" : "station-filter"}>{tab.label}</Link>
          ))}
        </div>}
      />
      <div className="kanban-summary">
        <div><span className="live-dot" /><strong>{data.summary.activeOrders}</strong> pesanan aktif di outlet</div>
        <span>Link ini khusus untuk {filter === "Semua" ? "semua stasiun" : `stasiun ${filter}`} · perubahan status tersimpan otomatis</span>
        <button
          type="button"
          className={soundEnabled ? "alarm-sound-toggle alarm-sound-on" : "alarm-sound-toggle"}
          aria-pressed={soundEnabled}
          onClick={toggleAlarmSound}
        >
          {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
          {soundEnabled ? "Suara alarm aktif" : "Aktifkan suara alarm"}
        </button>
      </div>
      {hasAlarm && !soundEnabled && (
        <div className="queue-alarm-banner" role="alert">
          <AlertTriangle size={16} />
          <span>Ada pesanan yang menunggu lebih dari 10 menit. Aktifkan suara alarm agar peringatan berbunyi.</span>
        </div>
      )}
      <div className="kanban-board">
        {columns.map((column) => {
          const columnOrders = visibleOrders.filter((order) => order.status === column.status);
          return (
            <section className={`kanban-column ${column.tone}`} key={column.status}>
              <div className="kanban-column-heading">
                <div><span className="column-dot" /><h2>{column.label}</h2></div>
                <span className="column-count">{columnOrders.length}</span>
              </div>
              <div className="kanban-column-body">
                {columnOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    filter={filter}
                    pending={pending}
                    canPickup={canPickup}
                    canPrint={canPrint}
                    canCancel={canCancel}
                    now={now}
                    onAction={onAction}
                    onCancel={onCancel}
                    onPrint={onPrint}
                  />
                ))}
                {columnOrders.length === 0 && <div className="kanban-empty">Belum ada pesanan</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
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
  now,
  onAction,
  onCancel,
  onPrint,
}: {
  order: Order;
  filter: "Semua" | "Kitchen" | "Barista";
  pending: boolean;
  canPickup: boolean;
  canPrint: boolean;
  canCancel: boolean;
  now: number | null;
  onAction: (id: string, action: OrderAction) => Promise<Order | null>;
  onCancel: (order: Order) => void;
  onPrint: (order: Order) => void;
}) {
  const tickets = order.tickets.filter((ticket) => filter === "Semua" || ticket.station === filter);
  const timed = isQueueTimedStatus(order.status);
  const level: QueueLevel = timed && now !== null ? getQueueLevel(order.createdAt, now) : "normal";
  const levelClass = level === "alarm" ? " order-card-alarm" : level === "warning" ? " order-card-warning" : "";
  return (
    <article className={`order-card${levelClass}`}>
      <div className="order-card-top">
        <div>
          <strong>{order.orderNumber}</strong>
          {order.customerName && <b className="order-customer">{order.customerName}</b>}
          <span>{dateTime(order.createdAt)}</span>
        </div>
        <div className="order-card-badges">
          <StatusBadge status={order.status} />
          {timed && (
            <span className="queue-timer" aria-label="Lama menunggu">
              <Clock3 size={12} /> {now === null ? "--:--" : formatQueueElapsed(order.createdAt, now)}
            </span>
          )}
        </div>
      </div>
      <div className="order-card-meta">
        <span>{order.type === "Dine-in" ? "Dine-in" : "Takeaway"}{order.table ? ` · ${order.table}` : ""}</span>
        {canPrint && <button className="order-print-button" title="Cetak nota dan tiket" onClick={() => onPrint(order)}><Printer size={14} /></button>}
      </div>
      {order.note && <div className="order-note"><FileText size={13} /> {order.note}</div>}
      <div className="ticket-list">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} order={order} ticket={ticket} pending={pending} onAction={onAction} />
        ))}
      </div>
      {order.status === "Ready for pickup" && canPickup && (
        <Button className="pickup-button" disabled={pending} onClick={() => onAction(order.id, { action: "pickup" })}>
          <Check size={15} /> Selesaikan pickup
        </Button>
      )}
      {canCancel && !["Completed", "Cancelled"].includes(order.status) && (
        <button className="cancel-order-button" onClick={() => onCancel(order)}>Batalkan pesanan</button>
      )}
      {order.status === "Cancelled" && order.cancelReason && <div className="cancel-reason">Alasan: {order.cancelReason}</div>}
      {order.status === "Completed" && <div className="completed-note"><Check size={14} /> Diambil pelanggan {order.collectedAt && dateTime(order.collectedAt)}</div>}
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
    <div className={`ticket-card ticket-${ticket.station.toLowerCase()}`}>
      <div className="ticket-heading">
        <span className="ticket-station-icon">{ticket.station === "Kitchen" ? "🍳" : "☕"}</span>
        <strong>{ticket.station}</strong>
        <Badge className={`ticket-status ticket-status-${ticket.status.toLowerCase()}`}>
          {ticket.status === "Queued" ? "Antrean" : ticket.status === "Preparing" ? "Diproses" : ticket.status === "Ready" ? "Siap" : "Batal"}
        </Badge>
      </div>
      <div className="ticket-items">
        {ticket.items.map((item) => (
          <div className="ticket-item" key={item.id}>
            <span><b>{item.quantity}×</b> {item.name}</span>
            {item.modifier && <small>{item.modifier}</small>}
          </div>
        ))}
      </div>
      {ticket.status === "Queued" && (
        <Button
          className="ticket-action"
          variant="outline"
          disabled={pending}
          onClick={() => onAction(order.id, { action: "start", station: ticket.station })}
        >
          Mulai produksi <ArrowRight size={14} />
        </Button>
      )}
      {ticket.status === "Preparing" && (
        <Button
          className="ticket-action ticket-ready-action"
          disabled={pending}
          onClick={() => onAction(order.id, { action: "ready", station: ticket.station })}
        >
          <Check size={14} /> Tandai siap
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
    <div className="screen-stack">
      <SectionTitle eyebrow="KATALOG & HARGA" title="Menu" action={<div className="menu-count">{data.products.length} menu terdaftar</div>} />
      <Card className="panel adjustment-panel">
        <div className="panel-heading"><div><h2>Tambah menu baru</h2><p>Menu langsung tersedia di kasir. Setiap menu wajib punya resep bahan.</p></div><Plus size={18} className="muted-icon" /></div>
        <ProductForm data={data} pending={pending} onCreate={onCreate} />
      </Card>
      <DiscountManager
        discounts={data.discounts}
        pending={pending}
        onCreate={onCreateDiscount}
        onSetActive={onSetDiscountActive}
        onRemove={onRemoveDiscount}
      />
      <Card className="panel table-panel">
        <div className="table-toolbar">
          <div><h2>Katalog menu</h2><p>Perubahan harga dan status langsung diterapkan pada kasir.</p></div>
          <div className="search-field table-search"><Search size={16} /><Input placeholder="Cari menu..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        </div>
        <div className="responsive-table">
          <table>
            <thead><tr><th>MENU</th><th>KATEGORI</th><th>STASIUN</th><th>HARGA JUAL</th><th>KETERSEDIAAN</th><th>AKSI</th></tr></thead>
            <tbody>
              {filtered.map((product) => (
                <MenuRow key={product.id} product={product} pending={pending} onSave={onSave} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="menu-hint"><Sparkles size={16} /><span>Harga di sini menjadi sumber utama transaksi. Setiap pesanan menyimpan snapshot harga pada saat dibayar.</span></div>
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
    <Card className="panel adjustment-panel">
      <div className="panel-heading">
        <div><h2>Master diskon</h2><p>Diskon dipilih kasir saat pembayaran. Potongan dihitung sebelum pajak.</p></div>
        <Tag size={18} className="muted-icon" />
      </div>
      <form className="adjustment-form product-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">Nama diskon
            <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Member 10%" />
          </label>
          <label className="field-label">Jenis
            <select className="field-select" value={kind} onChange={(event) => setKind(event.target.value as "Percent" | "Fixed")}>
              <option value="Percent">Persentase (%)</option>
              <option value="Fixed">Nominal (Rp)</option>
            </select>
          </label>
          <label className="field-label">{kind === "Percent" ? "Persentase (1–100)" : "Nominal potongan (Rp)"}
            <Input type="number" inputMode="numeric" min={1} step={1} value={value} onChange={(event) => setValue(event.target.value)} placeholder={kind === "Percent" ? "Contoh: 10" : "Contoh: 5000"} />
          </label>
          <label className="field-label">Minimal belanja (Rp)
            <Input type="number" inputMode="numeric" min={0} step={1} value={minSubtotal} onChange={(event) => setMinSubtotal(event.target.value)} placeholder="Kosongkan jika tidak ada" />
          </label>
          {kind === "Percent" && (
            <label className="field-label">Batas potongan maksimal (Rp)
              <Input type="number" inputMode="numeric" min={1} step={1} value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} placeholder="Kosongkan jika tanpa batas" />
            </label>
          )}
        </div>
        <Button type="submit" disabled={pending}>Tambah diskon <Plus size={16} /></Button>
      </form>
      {discounts.length === 0 ? (
        <EmptyState text="Belum ada master diskon. Tambahkan diskon pertama di atas." />
      ) : (
        <div className="responsive-table">
          <table>
            <thead><tr><th>NAMA</th><th>POTONGAN</th><th>MIN. BELANJA</th><th>BATAS MAKS.</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.id}>
                  <td><strong>{discount.name}</strong></td>
                  <td>{discount.kind === "Percent" ? `${discount.value}%` : money(discount.value)}</td>
                  <td>{discount.minSubtotal > 0 ? money(discount.minSubtotal) : "—"}</td>
                  <td>{discount.maxAmount !== null ? money(discount.maxAmount) : "—"}</td>
                  <td>
                    <span className={`availability ${discount.active ? "availability-on" : "availability-off"}`}>
                      <span />{discount.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => onSetActive(discount.id, !discount.active)}>
                        {discount.active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <button
                        className="icon-action"
                        disabled={pending}
                        title="Hapus diskon"
                        aria-label={`Hapus diskon ${discount.name}`}
                        onClick={() => {
                          if (window.confirm(`Hapus diskon "${discount.name}"? Riwayat transaksi lama tetap menyimpan nama dan potongannya.`)) {
                            void onRemove(discount.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    <tr>
      <td><div className="table-product"><span className="table-product-icon">{product.icon || "☕"}</span><div><strong>{product.name}</strong><span>{product.note || "Menu reguler"}</span></div></div></td>
      <td><Badge variant="secondary" className="category-badge">{product.category}</Badge></td>
      <td>
        <select
          className="field-select station-select"
          aria-label={`Stasiun ${product.name}`}
          value={product.station}
          disabled={pending}
          onChange={(event) => onSave(product.id, { station: event.target.value as "Kitchen" | "Barista" })}
        >
          <option value="Barista">Barista</option>
          <option value="Kitchen">Kitchen</option>
        </select>
      </td>
      <td>
        {editing
          ? <Input aria-label={`Harga ${product.name}`} type="number" min={1000} value={price} onChange={(event) => setPrice(event.target.value)} className="price-input" />
          : <strong>{money(product.price)}</strong>}
      </td>
      <td>
        <span className={`availability ${product.active && product.available ? "availability-on" : "availability-off"}`}>
          <span />{!product.active ? "Nonaktif" : product.available ? "Tersedia" : "Stok habis"}
        </span>
      </td>
      <td>
        <div className="table-actions">
          {editing ? (
            <>
              <button className="small-action small-action-save" disabled={pending} onClick={async () => {
                const value = Number(price);
                if (!Number.isInteger(value) || value < 1000) { toast.error("Harga minimal Rp1.000."); return; }
                const saved = await onSave(product.id, { price: value });
                if (saved !== null) setEditing(false);
              }}>Simpan</button>
              <button className="small-action" onClick={() => { setPrice(String(product.price)); setEditing(false); }}>Batal</button>
            </>
          ) : (
            <>
              <button className="small-action" onClick={() => setEditing(true)}>Ubah harga</button>
              <button
                className={`toggle-switch ${product.active ? "toggle-on" : ""}`}
                title={product.active ? "Nonaktifkan menu" : "Aktifkan menu"}
                disabled={pending}
                onClick={() => onSave(product.id, { active: !product.active })}
              ><span /></button>
            </>
          )}
        </div>
      </td>
    </tr>
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
    <div className="screen-stack">
      <SectionTitle eyebrow="BAHAN BAKU & MUTASI" title="Inventory" action={<Badge className={lowStock ? "inventory-warning" : "inventory-safe"}>{lowStock ? `${lowStock} stok perlu dicek` : "Semua stok aman"}</Badge>} />
      <div className="inventory-metrics">
        <MetricCard icon={Boxes} label="Jenis bahan" value={String(data.ingredients.length)} note="Bahan baku aktif" tone="metric-blue" />
        <MetricCard icon={AlertTriangle} label="Perlu restock" value={String(lowStock)} note="Menyentuh batas minimum" tone="metric-orange" />
        <MetricCard icon={ArrowDownRight} label="Mutasi tercatat" value={String(data.movements.length)} note="Riwayat terbaru" tone="metric-green" />
      </div>
      <div className="inventory-grid">
        <Card className="panel table-panel">
          <div className="panel-heading"><div><h2>Stok bahan baku</h2><p>Stok tersedia dihitung setelah reservasi tiket.</p></div><Boxes size={18} className="muted-icon" /></div>
          <div className="responsive-table">
            <table className="inventory-table">
              <thead><tr><th>BAHAN</th><th>ON HAND</th><th>RESERVED</th><th>TERSEDIA</th><th>MINIMUM</th></tr></thead>
              <tbody>
                {data.ingredients.map((ingredient) => {
                  const available = ingredient.onHand - ingredient.reserved;
                  const low = available <= ingredient.minimum;
                  return (
                    <tr key={ingredient.id}>
                      <td><strong>{ingredient.name}</strong></td>
                      <td>{ingredient.onHand} {ingredient.unit}</td>
                      <td>{ingredient.reserved} {ingredient.unit}</td>
                      <td><strong className={low ? "text-warning" : "text-good"}>{available} {ingredient.unit}</strong></td>
                      <td>{ingredient.minimum} {ingredient.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="panel adjustment-panel">
          <div className="panel-heading"><div><h2>Catat perubahan stok</h2><p>Barang masuk atau koreksi stok opname.</p></div><Plus size={18} className="muted-icon" /></div>
          <form onSubmit={submit} className="adjustment-form">
            <label className="field-label">Bahan baku
              <select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} className="field-select">
                {data.ingredients.map((ingredient) => <option value={ingredient.id} key={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
              </select>
            </label>
            <label className="field-label">Perubahan jumlah
              <Input type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Positif untuk masuk, negatif untuk koreksi" />
            </label>
            {selectedIngredient && <div className="adjustment-preview">Stok tersedia saat ini <strong>{selectedIngredient.onHand - selectedIngredient.reserved} {selectedIngredient.unit}</strong></div>}
            <label className="field-label">Alasan mutasi
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contoh: penerimaan stok pemasok" maxLength={160} />
            </label>
            <Button type="submit" className="full-button" disabled={pending}><Check size={16} /> Simpan mutasi</Button>
            <p className="form-caption">Stok tidak dapat dikurangi di bawah jumlah yang sudah direservasi untuk tiket.</p>
          </form>
        </Card>
      </div>
      <Card className="panel adjustment-panel">
        <div className="panel-heading"><div><h2>Tambah bahan baku</h2><p>Bahan baru bisa langsung dipakai sebagai resep menu.</p></div><Boxes size={18} className="muted-icon" /></div>
        <IngredientForm pending={pending} onCreate={onCreate} />
      </Card>
      <Card className="panel table-panel movement-panel">
        <div className="table-toolbar">
          <div><h2>Riwayat mutasi</h2><p>Reservasi saat pembayaran; Stock Out saat produksi. Audit/Waste hanya klasifikasi, bukan stok masuk.</p></div>
          <select className="field-select movement-filter" value={movementFilter} onChange={(event) => setMovementFilter(event.target.value)}>{movementTypes.map((type) => <option key={type}>{type}</option>)}</select>
        </div>
        <div className="responsive-table">
          <table>
            <thead><tr><th>WAKTU</th><th>BAHAN</th><th>JENIS</th><th>PERUBAHAN</th><th>ALASAN / PESANAN</th><th>OLEH</th></tr></thead>
            <tbody>
              {filteredMovements.map((movement) => (
                <tr key={movement.id}>
                  <td>{fullDate(movement.createdAt)} · {dateTime(movement.createdAt)}</td>
                  <td><strong>{movement.ingredientName}</strong></td>
                  <td><Badge variant="secondary" className="movement-type">{movement.type}</Badge></td>
                  <td className={movement.type === "Audit / Waste" || movement.amount < 0 ? "text-warning" : "text-good"}>
                    {movement.type === "Audit / Waste"
                      ? `${movement.amount} ${movement.unit ?? ""} · waste`
                      : `${movement.amount > 0 ? "+" : ""}${movement.amount} ${movement.unit ?? ""}`}
                  </td>
                  <td>{movement.reason}{movement.orderNumber && <span className="sub-cell"> · {movement.orderNumber}</span>}</td>
                  <td>{movement.actor}</td>
                </tr>
              ))}
              {filteredMovements.length === 0 && <tr><td colSpan={6}><EmptyState text="Belum ada mutasi untuk filter ini." /></td></tr>}
            </tbody>
          </table>
        </div>
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
    <div className="screen-stack">
      <SectionTitle
        eyebrow="KAS & PENGELUARAN"
        title="Kas"
        action={(
          <div className="cash-title-actions">
            <Badge className={data.cashShift ? "inventory-safe" : "inventory-warning"}>{data.cashShift ? "Shift dibuka" : "Shift belum dibuka"}</Badge>
            <Button type="button" variant="outline" size="sm" disabled={pending || data.printer.mode === "off"} onClick={() => openCashDrawer(runAction)}>
              Buka laci
            </Button>
          </div>
        )}
      />
      <div className="cash-grid">
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
      <Card className="panel table-panel">
        <div className="table-toolbar"><div><h2>Pengeluaran</h2><p>Belanja yang tercatat, lengkap dengan foto nota</p></div><Receipt size={18} className="muted-icon" /></div>
        <ExpenseTable expenses={data.expenses} isAdmin={data.user.role === "admin"} pending={pending} runAction={runAction} />
      </Card>
      <Card className="panel table-panel">
        <div className="table-toolbar"><div><h2>Riwayat shift</h2><p>Hasil penutupan kas dan selisih</p></div><Banknote size={18} className="muted-icon" /></div>
        <ShiftHistoryTable shifts={data.recentShifts} />
      </Card>
    </div>
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
    <Card className="panel">
      <div className="panel-heading">
        <div>
          <h2>Shift kas</h2>
          <p>{shift ? `Dibuka ${dateTime(shift.openedAt)} oleh ${shift.openedByName}` : "Buka shift sebelum menerima pembayaran tunai."}</p>
        </div>
        <Banknote size={18} className="muted-icon" />
      </div>
      {shift === null ? (
        <form className="adjustment-form" onSubmit={openShift}>
          <label className="field-label">
            Modal awal laci (Rp)
            <Input type="number" min={0} step={1} value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} />
          </label>
          <Button type="submit" disabled={pending}>Buka shift <ArrowRight size={15} /></Button>
        </form>
      ) : (
        <>
          <div className="cash-breakdown">
            <div><span>Modal awal</span><strong>{money(shift.openingFloat)}</strong></div>
            <div><span>Penjualan tunai</span><strong>{money(breakdown.cashSales)}</strong></div>
            <div><span>Refund tunai</span><strong>−{money(breakdown.cashRefunds)}</strong></div>
            <div><span>Pengeluaran dari laci</span><strong>−{money(breakdown.drawerExpenses)}</strong></div>
            <div className="cash-breakdown-total"><span>Kas seharusnya</span><strong>{money(shift.expectedCash)}</strong></div>
          </div>
          <form className="adjustment-form" onSubmit={closeShift}>
            <div className="cash-form-row">
              <label className="field-label">
                Uang dihitung di laci (Rp)
                <Input type="number" min={0} step={1} value={countedCash} onChange={(event) => setCountedCash(event.target.value)} />
              </label>
              <div className="cash-difference">
                <span className="field-label">Selisih</span>
                <strong className={liveDifference === null ? "" : liveDifference === 0 ? "text-good" : "text-warning"}>
                  {liveDifference === null ? "—" : money(liveDifference)}
                </strong>
              </div>
            </div>
            <label className="field-label">
              Catatan penutupan
              <Input value={closeNote} maxLength={240} onChange={(event) => setCloseNote(event.target.value)} placeholder="Opsional" />
            </label>
            <Button type="submit" disabled={pending || counted === null}>Tutup shift</Button>
          </form>
        </>
      )}
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
    <Card className="panel">
      <div className="panel-heading">
        <div>
          <h2>Catat pengeluaran</h2>
          <p>Belanja stok otomatis menambah stok bahan.</p>
        </div>
        <Receipt size={18} className="muted-icon" />
      </div>
      {drawerBlocked && <p className="checkout-warning">Buka shift kas dulu untuk belanja dari laci.</p>}
      <form className="adjustment-form" onSubmit={submit}>
        <label className="field-label">
          Sumber dana
          <select className="field-select" value={source} onChange={(event) => setSource(event.target.value as ExpenseSource)}>
            <option value="Drawer">{expenseSourceLabels.Drawer}</option>
            <option value="Non-cash">{expenseSourceLabels["Non-cash"]}</option>
          </select>
        </label>
        <label className="field-label">
          PIC pembeli
          <Input list={listId} value={picName} maxLength={60} onChange={(event) => setPicName(event.target.value)} placeholder="Nama yang berbelanja" />
        </label>
        <datalist id={listId}>
          {picSuggestions.map((name) => <option key={name} value={name} />)}
        </datalist>
        <label className="field-label">
          Bahan dibeli
          <select className="field-select" value={activeIngredientId} onChange={(event) => setIngredientId(event.target.value)} disabled={ingredients.length === 0}>
            {ingredients.length === 0 && <option value="">Belum ada bahan</option>}
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>
            ))}
          </select>
        </label>
        <div className="cash-form-row">
          <label className="field-label">
            Jumlah{selectedIngredient ? ` (${selectedIngredient.unit})` : ""}
            <Input type="number" min={0} step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label className="field-label">
            Total harga (Rp)
            <Input type="number" min={1} step={1} value={total} onChange={(event) => setTotal(event.target.value)} />
          </label>
        </div>
        <label className="field-label">
          Catatan
          <Input value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} placeholder="Opsional" />
        </label>
        <label className="field-label">
          Foto nota (wajib)
          <Input key={receiptKey} type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
        </label>
        <p className="expense-hint">
          {needsApproval
            ? `Di atas ${money(threshold)}: pengeluaran menunggu persetujuan admin.`
            : `Sampai ${money(threshold)}: otomatis disetujui.`}
        </p>
        <Button type="submit" disabled={pending || drawerBlocked || ingredients.length === 0}>Simpan pengeluaran</Button>
      </form>
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
    <div className="responsive-table">
      <table className="inventory-table">
        <thead>
          <tr><th>WAKTU</th><th>SUMBER</th><th>PIC</th><th>BAHAN</th><th>JUMLAH</th><th>TOTAL</th><th>NOTA</th><th>STATUS</th>{isAdmin && <th>AKSI</th>}</tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td>{dateTime(expense.createdAt)}</td>
              <td>{expenseSourceLabels[expense.source]}</td>
              <td>{expense.picName}</td>
              <td>{expense.ingredientName}</td>
              <td>{expense.quantity} {expense.unit}</td>
              <td>{money(expense.total)}</td>
              <td><a className="receipt-link" href={expense.receiptUrl} target="_blank" rel="noreferrer">Lihat nota</a></td>
              <td>
                <Badge variant="secondary" className={expense.status === "Rejected" ? "inventory-warning" : expense.status === "Pending" ? "inventory-warning" : "inventory-safe"}>
                  {expenseStatusLabels[expense.status]}
                </Badge>
              </td>
              {isAdmin && (
                <td>
                  {expense.status === "Pending" ? (
                    <div className="table-actions">
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => decide(expense, "approve")}>Setujui</Button>
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => decide(expense, "reject")}>Tolak</Button>
                    </div>
                  ) : (
                    <span className="sub-cell">{expense.decidedByName ? `oleh ${expense.decidedByName}` : "—"}</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShiftHistoryTable({ shifts }: { shifts: CashShift[] }) {
  const closed = shifts.filter((shift) => shift.closedAt !== null);
  if (closed.length === 0) return <EmptyState text="Belum ada shift yang ditutup." />;
  return (
    <div className="responsive-table">
      <table className="inventory-table">
        <thead>
          <tr><th>DITUTUP</th><th>OLEH</th><th>MODAL</th><th>SEHARUSNYA</th><th>DIHITUNG</th><th>SELISIH</th><th>CATATAN</th></tr>
        </thead>
        <tbody>
          {closed.map((shift) => {
            const difference = shift.difference ?? 0;
            return (
              <tr key={shift.id}>
                <td>{dateTime(shift.closedAt ?? shift.openedAt)}</td>
                <td>{shift.closedByName ?? shift.openedByName}</td>
                <td>{money(shift.openingFloat)}</td>
                <td>{money(shift.expectedCash)}</td>
                <td>{money(shift.countedCash ?? 0)}</td>
                <td className={difference === 0 ? "text-good" : "text-warning"}>{money(difference)}</td>
                <td>{shift.closeNote || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
    <div className="screen-stack">
      <SectionTitle eyebrow="PERFORMA BISNIS" title="Laporan" action={<Badge variant="secondary">7 hari terakhir</Badge>} />
      <div className="metric-grid">
        <MetricCard icon={Wallet} label="Penjualan hari ini" value={money(summary.todaySales)} note={`${summary.todayOrders} transaksi non-batal`} tone="metric-green" />
        <MetricCard icon={ChartNoAxesCombined} label="Rata-rata per hari" value={money(Math.round(summary.dailySales.reduce((sum, sale) => sum + sale.total, 0) / 7))} note="7 hari terakhir" tone="metric-blue" />
        <MetricCard icon={ClipboardList} label="Pesanan aktif" value={String(summary.activeOrders)} note="Belum selesai diambil" tone="metric-orange" />
      </div>
      <div className="dashboard-grid report-grid">
        <Card className="panel report-chart">
          <div className="panel-heading"><div><h2>Tren penjualan</h2><p>Nilai transaksi per hari</p></div><ChartNoAxesCombined size={18} className="muted-icon" /></div>
          <div className="sales-total">{money(summary.dailySales.reduce((sum, item) => sum + item.total, 0))}<span>Penjualan dalam periode</span></div>
          <div className="sales-chart">
            {summary.dailySales.map((sale) => (
              <div className="chart-column" key={sale.date}>
                <span className="chart-tooltip">{money(sale.total)}</span>
                <div className="chart-bar-track"><div className="chart-bar" style={{ height: `${Math.max(4, sale.total / maxDaily * 100)}%` }} /></div>
                <span className="chart-label">{sale.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="panel payment-report">
          <div className="panel-heading"><div><h2>Metode pembayaran</h2><p>Ringkasan pada 100 transaksi terbaru</p></div><CreditCard size={18} className="muted-icon" /></div>
          {orderMethods.length === 0 ? <EmptyState text="Belum ada transaksi." /> : orderMethods.map(([method, total]) => (
            <div className="payment-report-row" key={method}>
              <div className="payment-report-label"><span>{method}</span><strong>{money(total)}</strong></div>
              <div className="payment-progress"><span style={{ width: `${total / maxMethod * 100}%` }} /></div>
            </div>
          ))}
        </Card>
      </div>
      <Card className="panel table-panel">
        <div className="table-toolbar"><div><h2>Produk terlaris hari ini</h2><p>Rekap jumlah item terjual</p></div><Coffee size={18} className="muted-icon" /></div>
        <div className="best-products-grid">
          {summary.topProducts.length === 0 ? <EmptyState text="Belum ada penjualan hari ini." /> : summary.topProducts.map((product, index) => (
            <div className="best-product-card" key={product.name}><span>0{index + 1}</span><strong>{product.name}</strong><b>{product.quantity} item</b></div>
          ))}
        </div>
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
    <div className="image-upload-controls">
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
        <Upload size={14} /> {uploadLabel}
      </Button>
      {hasImage && (
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
          <Trash2 size={14} /> Hapus
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
    <Card className="panel settings-card">
      <div className="settings-card-icon"><Store size={20} /></div>
      <h2>Profil toko</h2>
      <p>Nama dan logo tampil di sidebar, nota, dan tiket cetak.</p>
      <div className="settings-media-row">
        <div className="logo-preview">
          {data.outletLogoUrl ? <img src={data.outletLogoUrl} alt="Logo toko" /> : <Coffee size={22} />}
        </div>
        <ImageUploadControls
          hasImage={data.outletLogoUrl !== null}
          uploadLabel="Unggah logo"
          disabled={pending}
          onUpload={uploadLogo}
          onRemove={() => runAction(() => requestJson("/api/settings/logo", "DELETE"), "Logo toko dihapus.")}
        />
      </div>
      <form className="settings-form" onSubmit={saveName}>
        <label className="field-label">Nama toko
          <Input value={storeName} maxLength={60} onChange={(event) => setStoreName(event.target.value)} />
        </label>
        <Button type="submit" className="settings-save" disabled={pending || trimmedName.length < 3 || trimmedName === data.outletName}>
          Simpan nama toko <ArrowRight size={15} />
        </Button>
      </form>
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
    <Card className="panel settings-card">
      <div className="settings-card-icon settings-info-icon"><UserRound size={20} /></div>
      <h2>Akun saya</h2>
      <p>Foto dan nama Anda tampil di sidebar dan topbar.</p>
      <div className="settings-media-row">
        <Avatar src={data.userAvatarUrl} name={data.user.name} className="profile-avatar" />
        <ImageUploadControls
          hasImage={data.userAvatarUrl !== null}
          uploadLabel="Ganti foto"
          disabled={pending}
          onUpload={uploadAvatar}
          onRemove={() => runAction(() => requestJson("/api/account/avatar", "DELETE"), "Foto profil dihapus.")}
        />
      </div>
      <form className="settings-form" onSubmit={saveName}>
        <label className="field-label">Nama tampilan
          <Input value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <Button type="submit" className="settings-save" disabled={pending || trimmedName.length < 2 || trimmedName === data.user.name}>
          Simpan nama <ArrowRight size={15} />
        </Button>
      </form>
      <form className="settings-form settings-password-form" onSubmit={savePassword}>
        <span className="settings-subtitle">Ubah password</span>
        <label className="field-label">Password saat ini
          <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label className="field-label">Password baru
          <Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label className="field-label">Ulangi password baru
          <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </label>
        <Button
          type="submit"
          className="settings-save"
          disabled={pending || !currentPassword || newPassword.length < 8 || !confirmPassword}
        >
          Ubah password <ArrowRight size={15} />
        </Button>
      </form>
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
    <Card className="panel settings-card settings-card-wide">
      <div className="settings-card-icon"><Users size={20} /></div>
      <h2>Kelola akun</h2>
      <p>Atur ulang password akun karyawan jika mereka lupa. Password akun Anda sendiri diubah di bagian Akun saya.</p>
      <div className="account-list">
        {otherAccounts.length === 0 && <EmptyState text="Belum ada akun karyawan lain." />}
        {otherAccounts.map((account) => (
          <div className="account-row" key={account.id}>
            <div className="account-row-main">
              <Avatar src={account.avatarUrl} name={account.name} className="account-avatar" />
              <div className="account-info"><strong>{account.name}</strong><span>@{account.username}</span></div>
              <Badge variant="secondary">{roleLabels[account.role]}</Badge>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => toggleReset(account.id)}>
                <KeyRound size={14} /> Atur ulang password
              </Button>
            </div>
            {resetId === account.id && (
              <form className="account-reset-form" onSubmit={(event) => resetAccount(event, account)}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password baru (min. 8 karakter)"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
                <Button type="submit" size="sm" disabled={pending || resetPassword.length < 8}>Simpan</Button>
                <span>Sesi aktif akun ini akan keluar otomatis.</span>
              </form>
            )}
          </div>
        ))}
      </div>
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
    <div className="screen-stack">
      <SectionTitle eyebrow="KONFIGURASI OUTLET" title="Pengaturan" />
      <div className="settings-grid">
        <StoreProfileCard data={data} pending={pending} runAction={runAction} />
        <AccountCard data={data} pending={pending} runAction={runAction} />
        <AccountsCard data={data} pending={pending} runAction={runAction} />
        <Card className="panel settings-card">
          <div className="settings-card-icon"><Printer size={20} /></div>
          <h2>Pencetakan nota</h2>
          <p>Atur lebar kertas printer thermal. Lebar ini juga dipakai saat cetak langsung dari server.</p>
          <label className="field-label">Lebar kertas
            <select className="field-select" value={width} onChange={(event) => setWidth(Number(event.target.value) as 58 | 80)}>
              <option value={58}>58 mm · compact</option>
              <option value={80}>80 mm · standar</option>
            </select>
          </label>
          <div className={`paper-preview paper-${width}`}>
            <span>{data.outletName}</span><span>Preview lebar {width} mm</span><div /><i />
          </div>
          <Button className="settings-save" onClick={saveReceipt} disabled={pending}>Simpan pengaturan <ArrowRight size={15} /></Button>
        </Card>
        <ExpenseApprovalCard data={data} pending={pending} runAction={runAction} />
        <PrinterCard data={data} pending={pending} runAction={runAction} />
        <TaxReceiptCard data={data} pending={pending} runAction={runAction} />
        <Card className="panel settings-card settings-card-wide">
          <div className="settings-card-icon"><Store size={20} /></div>
          <h2>Denah meja</h2>
          <p>Atur meja dan posisinya di peta outlet. Kasir memilih meja dari denah yang sama.</p>
          <TableLayoutEditor tables={data.tables} shapes={data.mapShapes} pending={pending} runAction={runAction} />
        </Card>
        <Card className="panel settings-card settings-info">
          <div className="settings-card-icon settings-info-icon"><UserRound size={20} /></div>
          <h2>Akses & keamanan</h2>
          <p>Akun demo menggunakan role operasional dengan izin yang dibatasi di sisi server.</p>
          <div className="role-list">
            {[
              ["admin", "Kelola menu, stok, laporan, dan pembatalan"],
              ["kasir", "Transaksi, cetak, dan penyelesaian pickup"],
              ["barista", "Lihat dan proses tiket minuman"],
              ["kitchen", "Lihat dan proses tiket makanan"],
            ].map(([label, description]) => <div key={label}><Badge variant="secondary">{label}</Badge><span>{description}</span></div>)}
          </div>
          <div className="server-note"><span className="live-dot" /> Server berjalan lokal · Database SQLite</div>
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
    <Card className="panel settings-card">
      <div className="settings-card-icon"><Banknote size={20} /></div>
      <h2>Persetujuan pengeluaran</h2>
      <p>Pengeluaran di atas batas ini menunggu persetujuan admin. Bahan tetap masuk stok dan pengeluaran laci tetap dihitung sampai ditolak.</p>
      <label className="field-label">
        Batas (Rp)
        <Input type="number" min={0} step={1} value={threshold} onChange={(event) => setThreshold(event.target.value)} />
      </label>
      <Button className="settings-save" onClick={save} disabled={pending}>Simpan batas <ArrowRight size={15} /></Button>
    </Card>
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
    <Card className="panel settings-card">
      <div className="settings-card-icon"><Printer size={20} /></div>
      <h2>Printer thermal (server)</h2>
      <p>Nota dan tiket dikirim langsung dari server ke printer. Pilih Nonaktif untuk memakai cetak lewat browser saja.</p>
      <form className="settings-form" onSubmit={save}>
        <label className="field-label">Metode koneksi
          <select className="field-select" value={mode} onChange={(event) => setMode(event.target.value as PrinterFormMode)}>
            <option value="off">Nonaktif (cetak lewat browser)</option>
            <option value="network">Jaringan LAN (IP:port, umumnya 9100)</option>
            <option value="serial">Port serial (Bluetooth Classic / COM / USB-serial)</option>
            <option value="system">Printer terpasang di sistem (CUPS di macOS/Linux, antrian printer di Windows)</option>
          </select>
        </label>
        {mode === "network" && (
          <>
            <label className="field-label">Alamat IP printer
              <Input value={host} placeholder="192.168.1.50" maxLength={253} onChange={(event) => setHost(event.target.value)} />
            </label>
            <label className="field-label">Port
              <Input type="number" min={1} max={65535} value={port} onChange={(event) => setPort(event.target.value)} />
            </label>
          </>
        )}
        {mode === "serial" && (
          <>
            <div className="serial-port-panel">
              <div className="serial-port-heading">
                <span>Port terdeteksi (diperbarui otomatis)</span>
                <Badge className="inventory-safe">Live</Badge>
              </div>
              {portScanError && <p className="serial-port-empty">{portScanError}</p>}
              {!portScanError && serialPorts.length === 0 && (
                <p className="serial-port-empty">Belum ada port. Pasangkan printer Bluetooth lewat Pengaturan Bluetooth Windows, lalu tunggu beberapa detik.</p>
              )}
              {serialPorts.map((port) => {
                const isSaved = data.printer.mode === "serial" && data.printer.serialPath === port.path;
                return (
                  <div key={port.path} className={`serial-port-row${isSaved ? " is-saved" : ""}`}>
                    <div className="serial-port-info">
                      <strong>{port.path}</strong>
                      <span>{port.manufacturer || "Perangkat serial"}</span>
                    </div>
                    <div className="serial-port-badges">
                      {port.isBluetooth && <Badge className="inventory-safe">Bluetooth</Badge>}
                      {isSaved && <Badge className="inventory-safe">Tersimpan</Badge>}
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => connectPort(port.path)}>
                      Hubungkan &amp; simpan
                    </Button>
                  </div>
                );
              })}
            </div>
            <label className="field-label">Port serial (isi manual jika tidak terdeteksi)
              <Input value={serialPath} placeholder="COM3 atau /dev/cu.NAMA-PRINTER" maxLength={255} onChange={(event) => setSerialPath(event.target.value)} />
            </label>
            <label className="field-label">Baud rate
              <select className="field-select" value={baudRate} onChange={(event) => setBaudRate(event.target.value)}>
                {PRINTER_BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate}>{rate}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {mode === "system" && (
          <label className="field-label">Nama printer di sistem
            <Input value={systemName} placeholder="EPSON_TM_T82" maxLength={100} onChange={(event) => setSystemName(event.target.value)} />
          </label>
        )}
        {mode !== "off" && (
          <label className="drawer-toggle">
            <input type="checkbox" checked={drawerAutoOpen} onChange={(event) => setDrawerAutoOpen(event.target.checked)} />
            <span>Buka laci otomatis setiap pembayaran tunai (laci terhubung ke printer lewat kabel RJ11)</span>
          </label>
        )}
        <div className="print-actions">
          <Button type="button" variant="outline" onClick={() => openCashDrawer(runAction)} disabled={pending || data.printer.mode === "off"}>Buka laci sekarang</Button>
          <Button type="button" variant="outline" onClick={testPrint} disabled={pending || mode === "off"}>Tes cetak</Button>
          <Button type="submit" className="settings-save" disabled={pending}>Simpan printer <ArrowRight size={15} /></Button>
        </div>
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
    <Card className="panel settings-card">
      <div className="settings-card-icon"><Wallet size={20} /></div>
      <h2>Pajak & catatan struk</h2>
      <p>Pajak dihitung otomatis di kasir. Catatan kaki tampil di bagian bawah nota.</p>
      <form className="settings-form" onSubmit={save}>
        <label className="field-label">Pajak (%)
          <Input type="number" min={0} max={30} step="0.01" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} />
        </label>
        <label className="field-label">Catatan kaki struk
          <Input value={footer} maxLength={120} onChange={(event) => setFooter(event.target.value)} />
        </label>
        <Button type="submit" className="settings-save" disabled={pending}>Simpan pajak & catatan <ArrowRight size={15} /></Button>
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
    <form className="adjustment-form product-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field-label">Nama menu
          <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Es Kopi Susu" />
        </label>
        <label className="field-label">Kategori
          <Input value={category} maxLength={40} onChange={(event) => setCategory(event.target.value)} placeholder="Contoh: Kopi, Makanan" />
        </label>
        <label className="field-label">Harga jual (Rp)
          <Input type="number" min={1000} value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
        <label className="field-label">Stasiun produksi
          <select className="field-select" value={station} onChange={(event) => setStation(event.target.value as "Kitchen" | "Barista")}>
            <option value="Barista">Barista · minuman</option>
            <option value="Kitchen">Kitchen · makanan</option>
          </select>
        </label>
        <label className="field-label">Ikon (emoji)
          <Input value={icon} maxLength={8} onChange={(event) => setIcon(event.target.value)} placeholder="☕" />
        </label>
        <label className="field-label">Catatan singkat
          <Input value={note} maxLength={60} onChange={(event) => setNote(event.target.value)} placeholder="Opsional" />
        </label>
        <label className="field-label full-span">Modifier (pisahkan dengan koma)
          <Input value={modifiers} onChange={(event) => setModifiers(event.target.value)} placeholder="Less sugar, Extra shot" />
        </label>
      </div>
      <div className="recipe-editor">
        <span className="settings-subtitle">Resep per porsi</span>
        {recipe.map((line, index) => (
          <div className="recipe-line" key={index}>
            <select
              className="field-select"
              aria-label="Bahan resep"
              value={line.ingredientId}
              onChange={(event) => updateLine(index, { ingredientId: event.target.value })}
            >
              <option value="" disabled>Pilih bahan</option>
              {data.ingredients.map((ingredient) => (
                <option value={ingredient.id} key={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>
              ))}
            </select>
            <Input
              type="number"
              step="any"
              min={0}
              aria-label="Jumlah bahan"
              placeholder="Jumlah"
              value={line.amount}
              onChange={(event) => updateLine(index, { amount: event.target.value })}
            />
            <button
              type="button"
              className="small-action"
              aria-label="Hapus baris resep"
              disabled={recipe.length === 1}
              onClick={() => setRecipe((lines) => lines.filter((_, lineIndex) => lineIndex !== index))}
            ><X size={14} /></button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={recipe.length >= 20} onClick={() => setRecipe((lines) => [...lines, { ingredientId: "", amount: "" }])}>
          <Plus size={14} /> Tambah bahan
        </Button>
      </div>
      <Button type="submit" className="full-button" disabled={pending}><Check size={16} /> Simpan menu</Button>
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
    <form className="adjustment-form" onSubmit={submit}>
      <label className="field-label">Nama bahan
        <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Susu full cream" />
      </label>
      <label className="field-label">Satuan
        <Input value={unit} maxLength={12} onChange={(event) => setUnit(event.target.value)} placeholder="Contoh: ml, gram, pcs" />
      </label>
      <div className="form-grid">
        <label className="field-label">Stok awal
          <Input type="number" min={0} step="any" value={initialStock} onChange={(event) => setInitialStock(event.target.value)} />
        </label>
        <label className="field-label">Batas minimum
          <Input type="number" min={0} step="any" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
        </label>
      </div>
      <Button type="submit" className="full-button" disabled={pending}><Plus size={16} /> Tambah bahan</Button>
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

  async function deleteTable() {
    if (!selected) return;
    if (!window.confirm(`Hapus ${selected.name} dari denah?`)) return;
    const result = await runAction(
      () => requestJson(`/api/tables/${selected.id}`, "DELETE"),
      "Meja dihapus.",
    );
    if (result !== null) setSelection(null);
  }

  function moveTable(table: DiningTable, x: number, y: number) {
    void runAction(
      () => requestJson(`/api/tables/${table.id}`, "PATCH", { x, y }),
      "Posisi meja tersimpan.",
    );
  }

  return (
    <div className="table-editor">
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
      <div className="table-editor-side">
        <form className="table-add-form" onSubmit={addTable}>
          <label className="field-label">Tambah meja
            <div className="inline-field">
              <Input
                value={newName}
                maxLength={32}
                placeholder="Contoh: Meja 11 atau VIP 1"
                onChange={(event) => setNewName(event.target.value)}
              />
              <Button type="submit" disabled={pending || !trimmedNewName}><Plus size={15} /> Tambah</Button>
            </div>
          </label>
        </form>
        <div className="shape-toolbar">
          <span className="shape-toolbar-label">Tambah area ke denah</span>
          <div className="shape-toolbar-buttons">
            {shapeKindOptions.map(({ kind, label, icon: Icon }) => (
              <Button key={kind} type="button" size="sm" variant="outline" disabled={pending} onClick={() => addShape(kind)}>
                <Icon size={15} /> {label}
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
          <div className="table-detail">
            <div className="table-detail-heading">
              <strong>{selected.name}</strong>
              <span className={`table-state ${selected.occupied ? "is-occupied" : "is-free"}`}>
                {selected.occupied ? "Terisi" : "Kosong"}
              </span>
            </div>
            {selected.occupied && (
              <p className="table-picker-hint">
                Meja terisi tidak bisa diganti nama atau dihapus. Pesanan terbuka: {selected.openOrderNumber}.
              </p>
            )}
            <label className="field-label">Nama meja
              <Input
                value={renameValue}
                maxLength={32}
                disabled={selected.occupied}
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </label>
            <div className="table-detail-actions">
              <Button
                type="button"
                variant="outline"
                disabled={pending || selected.occupied || !trimmedRename || trimmedRename === selected.name}
                onClick={renameTable}
              >
                Simpan nama
              </Button>
              <Button type="button" variant="destructive" disabled={pending || selected.occupied} onClick={deleteTable}>
                <Trash2 size={15} /> Hapus meja
              </Button>
            </div>
          </div>
        ) : (
          <p className="table-picker-hint">Pilih meja atau area di peta. Geser meja untuk mengatur posisinya; pilih area lalu geser sudutnya untuk mengubah ukuran.</p>
        )}
        <p className="table-count">{tables.length} meja · {shapes.length} area di denah</p>
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

  async function deleteShape() {
    if (!window.confirm(`Hapus ${shapeKindLabels[shape.kind]} dari denah?`)) return;
    const result = await runAction(() => requestJson(`/api/map-shapes/${shape.id}`, "DELETE"), "Area dihapus.");
    if (result !== null) onDeleted();
  }

  return (
    <div className="table-detail">
      <div className="table-detail-heading">
        <strong>{shapeKindLabels[shape.kind]}</strong>
      </div>
      <p className="table-picker-hint">Area hanya untuk gambaran denah dan tidak memengaruhi pesanan.</p>
      <label className="field-label">Label (opsional)
        <Input
          value={label}
          maxLength={32}
          placeholder="Contoh: Area indoor"
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <div className="shape-size-grid">
        <label className="field-label">Lebar
          <Input type="number" min={2} max={100} step="any" value={width} onChange={(event) => setWidth(event.target.value)} />
        </label>
        <label className="field-label">Tinggi
          <Input type="number" min={2} max={100} step="any" value={height} onChange={(event) => setHeight(event.target.value)} />
        </label>
      </div>
      {!sizeValid && <p className="table-picker-hint">Lebar dan tinggi harus antara 2 dan 100.</p>}
      <div className="table-detail-actions">
        <Button type="button" variant="outline" disabled={pending || !sizeValid || !changed} onClick={saveShape}>
          Simpan area
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={deleteShape}>
          <Trash2 size={15} /> Hapus area
        </Button>
      </div>
    </div>
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
    <div className="setup-shell">
      <Toaster richColors position="top-right" />
      <header className="setup-header">
        <div className="brand-icon"><Coffee size={21} /></div>
        <div><strong>Kopi Senja</strong><span>SETUP AWAL OUTLET</span></div>
      </header>
      <ol className="setup-steps">
        {setupSteps.map((label, index) => (
          <li key={label} className={index === step ? "setup-step setup-step-active" : index < step ? "setup-step setup-step-done" : "setup-step"}>
            <span>{index < step ? <Check size={14} /> : index + 1}</span>{label}
          </li>
        ))}
      </ol>
      <Card className="panel setup-card">
        {step === 0 && (
          <>
            <div className="setup-step-heading">
              <span className="eyebrow">LANGKAH 1 DARI 5</span>
              <h1>Profil toko</h1>
              <p>Nama, logo, pajak, dan struk tampil di sidebar, nota, dan tiket cetak.</p>
            </div>
            <div className="settings-media-row">
              <div className="logo-preview">
                {data.outletLogoUrl ? <img src={data.outletLogoUrl} alt="Logo toko" /> : <Coffee size={22} />}
              </div>
              <ImageUploadControls
                hasImage={data.outletLogoUrl !== null}
                uploadLabel="Unggah logo"
                disabled={pending}
                onUpload={uploadLogo}
                onRemove={() => runAction(() => requestJson("/api/settings/logo", "DELETE"), "Logo toko dihapus.")}
              />
            </div>
            <form className="setup-form" onSubmit={saveProfile}>
              <div className="form-grid">
                <label className="field-label">Nama toko
                  <Input value={storeName} maxLength={60} onChange={(event) => setStoreName(event.target.value)} />
                </label>
                <label className="field-label">Pajak (%)
                  <Input type="number" min={0} max={30} step="0.01" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} />
                </label>
                <label className="field-label">Lebar kertas struk
                  <select className="field-select" value={width} onChange={(event) => setWidth(Number(event.target.value) as 58 | 80)}>
                    <option value={58}>58 mm · compact</option>
                    <option value={80}>80 mm · standar</option>
                  </select>
                </label>
                <label className="field-label full-span">Catatan kaki struk
                  <Input value={footer} maxLength={120} onChange={(event) => setFooter(event.target.value)} placeholder="Contoh: Terima kasih, sampai jumpa lagi!" />
                </label>
              </div>
              <div className="setup-actions">
                <span />
                <Button type="submit" disabled={pending || trimmedName.length < 3}>Simpan & lanjut <ArrowRight size={15} /></Button>
              </div>
            </form>
          </>
        )}
        {step === 1 && (
          <>
            <div className="setup-step-heading">
              <span className="eyebrow">LANGKAH 2 DARI 5</span>
              <h1>Bahan baku</h1>
              <p>Bahan dipakai sebagai resep menu. Minimal tambahkan satu bahan sebelum lanjut.</p>
            </div>
            <div className="setup-list">
              {data.ingredients.map((ingredient) => (
                <div className="setup-list-row" key={ingredient.id}>
                  <strong>{ingredient.name}</strong>
                  <span>{ingredient.onHand} {ingredient.unit} · minimum {ingredient.minimum} {ingredient.unit}</span>
                </div>
              ))}
              {data.ingredients.length === 0 && <EmptyState text="Belum ada bahan baku." />}
            </div>
            <IngredientForm
              pending={pending}
              onCreate={(input) => runAction(() => requestJson("/api/ingredients", "POST", input), "Bahan baku ditambahkan.")}
            />
            <div className="setup-actions">
              <Button type="button" variant="outline" onClick={() => setStep(0)}>Kembali</Button>
              <Button type="button" onClick={() => setStep(2)} disabled={data.ingredients.length === 0}>Lanjut <ArrowRight size={15} /></Button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="setup-step-heading">
              <span className="eyebrow">LANGKAH 3 DARI 5</span>
              <h1>Menu</h1>
              <p>Setiap menu wajib punya stasiun produksi dan resep bahan. Minimal satu menu aktif.</p>
            </div>
            <div className="setup-list">
              {data.products.map((product) => (
                <div className="setup-list-row" key={product.id}>
                  <strong>{product.icon} {product.name}</strong>
                  <span>{money(product.price)} · {product.station}</span>
                </div>
              ))}
              {data.products.length === 0 && <EmptyState text="Belum ada menu." />}
            </div>
            <ProductForm
              data={data}
              pending={pending}
              onCreate={(input) => runAction(() => requestJson("/api/products", "POST", input), "Menu ditambahkan.")}
            />
            <div className="setup-actions">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Kembali</Button>
              <Button type="button" onClick={() => setStep(3)} disabled={activeProducts === 0}>Lanjut <ArrowRight size={15} /></Button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="setup-step-heading">
              <span className="eyebrow">LANGKAH 4 DARI 5</span>
              <h1>Denah meja</h1>
              <p>Tambahkan meja dan letakkan sesuai posisi di outlet. Kasir memilih meja dari denah ini. Langkah ini bisa dilewati jika outlet hanya melayani takeaway.</p>
            </div>
            <TableLayoutEditor tables={data.tables} shapes={data.mapShapes} pending={pending} runAction={runAction} />
            <div className="setup-actions">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>Kembali</Button>
              <Button type="button" onClick={() => setStep(4)}>Lanjut <ArrowRight size={15} /></Button>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <div className="setup-step-heading">
              <span className="eyebrow">LANGKAH 5 DARI 5</span>
              <h1>Selesai</h1>
              <p>Data ini langsung dipakai di kasir, pesanan, dan inventory setelah setup selesai.</p>
            </div>
            <div className="setup-summary">
              <div><strong>{data.outletName}</strong><span>Nama toko</span></div>
              <div><strong>{data.ingredients.length}</strong><span>Bahan baku</span></div>
              <div><strong>{activeProducts}</strong><span>Menu aktif</span></div>
              <div><strong>{data.taxRateBasisPoints / 100}%</strong><span>Pajak</span></div>
              <div><strong>{data.tables.length}</strong><span>Meja</span></div>
            </div>
            <div className="setup-actions">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>Kembali</Button>
              <Button type="button" onClick={finishSetup} disabled={pending || activeProducts === 0 || data.ingredients.length === 0}>
                Selesai & buka aplikasi <ArrowRight size={15} />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span><Coffee size={18} /></span>{text}</div>;
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
    <div className="print-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="print-modal" role="dialog" aria-modal="true" aria-labelledby="print-title">
        <div className="print-modal-header">
          <div><div className="print-modal-icon"><Printer size={19} /></div><div><h2 id="print-title">Dokumen transaksi</h2><p>Nota pelanggan dan tiket produksi</p></div></div>
          <button className="close-plain" onClick={onClose} aria-label="Tutup"><X size={20} /></button>
        </div>
        <div className="print-documents">
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
        <div className="print-bluetooth">
          <span className="print-bluetooth-status" data-connected={bluetoothPrinter ? "true" : "false"}>
            {bluetoothPrinter ? <BluetoothConnected size={16} /> : <Bluetooth size={16} />}
            {bluetoothPrinter ? `Terhubung ke ${bluetoothPrinter.name}` : bluetoothSupported ? "Printer thermal Bluetooth belum terhubung" : "Browser ini tidak mendukung Bluetooth (pakai Chrome atau Edge)"}
          </span>
          {bluetoothSupported && (bluetoothPrinter ? (
            <div className="print-actions">
              <Button variant="outline" onClick={disconnectBrowserPrinter} disabled={sending}>Putuskan</Button>
              <Button onClick={printOverBluetooth} disabled={sending}><Printer size={16} /> {sending ? "Mengirim..." : "Cetak ke Bluetooth"}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={connectBluetooth} disabled={connecting || sending}>
              <Bluetooth size={16} /> {connecting ? "Menghubungkan..." : "Connect ke printer thermal"}
            </Button>
          ))}
        </div>
        <div className="print-modal-footer">
          <p><Printer size={14} /> {serverPrintEnabled ? "Cetak ke printer thermal dikirim dari server. Cetak lewat browser tersedia sebagai cadangan." : "Satu aksi akan mencetak nota dan semua tiket stasiun."}</p>
          <div className="print-actions">
            {serverPrintEnabled ? (
              <>
                <Button variant="outline" onClick={() => window.print()} disabled={sending}>Cetak lewat browser</Button>
                <Button onClick={printOnServer} disabled={sending}><Printer size={16} /> {sending ? "Mengirim..." : "Cetak ke printer"}</Button>
              </>
            ) : (
              <Button onClick={() => window.print()}><Printer size={16} /> Cetak semua dokumen</Button>
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
