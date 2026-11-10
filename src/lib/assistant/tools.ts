import type { SessionUser, UserRole } from "@/lib/types";
import {
  getDiningTables,
  getIngredients,
  getOpenCashShift,
  getOrders,
  getProducts,
  getReceivables,
  getRecentCashShifts,
  getSummary,
} from "@/lib/pos-service";

type AssistantTool = {
  name: string;
  description: string;
  roles: UserRole[];
  run: (user: SessionUser) => unknown;
};

const ALL_ROLES: UserRole[] = ["admin", "cashier", "barista", "kitchen"];
const SALES_ROLES: UserRole[] = ["admin", "cashier"];
const ACTIVE_STATUSES = new Set(["Queued", "Preparing", "Ready for pickup"]);

// Setiap tool hanya memanggil getter yang juga dipakai untuk role tersebut di getPosBootstrap,
// sehingga AI tidak melihat data yang tidak bisa dilihat user di layar.
const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: "get_sales_summary",
    description: "Ringkasan penjualan hari ini: total penjualan, jumlah pesanan, pesanan aktif, penjualan 7 hari terakhir, dan produk terlaris.",
    roles: SALES_ROLES,
    run: () => getSummary(true),
  },
  {
    name: "get_active_orders",
    description: "Daftar pesanan yang sedang aktif (antrean, sedang diproses, siap diambil) beserta item dan statusnya.",
    roles: ALL_ROLES,
    run: (user) => getOrders(user)
      .filter((order) => ACTIVE_STATUSES.has(order.status))
      .map((order) => ({
        orderNumber: order.orderNumber,
        type: order.type,
        table: order.table,
        customerName: order.customerName,
        status: order.status,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          modifier: item.modifier,
          station: item.station,
        })),
      })),
  },
  {
    name: "get_tables",
    description: "Status semua meja: nama meja, apakah sedang terisi, dan nomor pesanan yang sedang berjalan di meja tersebut.",
    roles: ALL_ROLES,
    run: () => getDiningTables().map((table) => ({
      name: table.name,
      occupied: table.occupied,
      openOrderNumber: table.openOrderNumber,
    })),
  },
  {
    name: "get_menu",
    description: "Daftar menu aktif beserta kategori, harga (Rupiah), ketersediaan, dan stasiun pembuatnya.",
    roles: SALES_ROLES,
    run: () => getProducts()
      .filter((product) => product.active)
      .map((product) => ({
        name: product.name,
        category: product.category,
        price: product.price,
        available: product.available,
        station: product.station,
      })),
  },
  {
    name: "get_low_stock",
    description: "Bahan baku yang stok tersedianya (stok fisik dikurangi reservasi) sudah sama dengan atau di bawah batas minimum.",
    roles: ["admin"],
    run: () => getIngredients()
      .map((ingredient) => ({
        name: ingredient.name,
        unit: ingredient.unit,
        available: ingredient.onHand - ingredient.reserved,
        minimum: ingredient.minimum,
      }))
      .filter((ingredient) => ingredient.available <= ingredient.minimum),
  },
  {
    name: "get_cash_shift",
    description: "Status shift kasir: shift yang sedang dibuka (jika ada) dan lima shift terakhir beserta selisih kas.",
    roles: SALES_ROLES,
    run: () => ({
      openShift: getOpenCashShift(),
      recentShifts: getRecentCashShifts(5),
    }),
  },
  {
    name: "get_receivables",
    description: "Daftar piutang kasbon (bayar nanti) yang belum lunas beserta nama pelanggan dan sisa tagihan.",
    roles: SALES_ROLES,
    run: () => getReceivables()
      .filter((receivable) => receivable.outstanding > 0)
      .map((receivable) => ({
        orderNumber: receivable.orderNumber,
        customerName: receivable.customerName,
        createdAt: receivable.createdAt,
        total: receivable.total,
        paid: receivable.paid,
        outstanding: receivable.outstanding,
      })),
  },
];

export function getAssistantFunctionDeclarations(user: SessionUser) {
  return ASSISTANT_TOOLS
    .filter((tool) => tool.roles.includes(user.role))
    .map(({ name, description }) => ({ name, description }));
}

export function runAssistantTool(user: SessionUser, name: string): { result: unknown } | { error: string } {
  const tool = ASSISTANT_TOOLS.find((candidate) => candidate.name === name);
  if (!tool || !tool.roles.includes(user.role)) {
    return { error: "Data ini tidak tersedia untuk role akun ini." };
  }
  try {
    return { result: tool.run(user) };
  } catch (error) {
    console.error(`Tool asisten ${name} gagal.`, error);
    return { error: "Data tidak dapat diambil saat ini." };
  }
}
