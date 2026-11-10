import "server-only";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { PRINTER_BAUD_RATES } from "@/lib/types";
import type {
  CashShift,
  CashShiftBreakdown,
  CreditStatus,
  CustomerSuggestion,
  Discount,
  DiscountKind,
  Expense,
  ExpenseIngredient,
  ExpenseSource,
  ExpenseStatus,
  Ingredient,
  InventoryMovement,
  ManagedAccount,
  Order,
  OrderCredit,
  OrderItem,
  PosBootstrap,
  PosSummary,
  PrinterSettings,
  DiningTable,
  MapShape,
  MapShapeKind,
  Product,
  Receivable,
  SessionUser,
  StationTicket,
  TablePickerMode,
  UserRole,
} from "@/lib/types";
import {
  adminPasswordResetSchema,
  createOrderSchema,
  creditPaymentSchema,
  discountCreateSchema,
  discountUpdateSchema,
  diningTableCreateSchema,
  diningTableUpdateSchema,
  expenseDecisionSchema,
  expenseFieldsSchema,
  ingredientCreateSchema,
  inventoryMovementSchema,
  mapShapeCreateSchema,
  mapShapeUpdateSchema,
  orderActionSchema,
  passwordChangeSchema,
  productCreateSchema,
  productUpdateSchema,
  profileUpdateSchema,
  settingsUpdateSchema,
  shiftCloseSchema,
  shiftOpenSchema,
} from "@/lib/validation";
import { MAX_RECEIPT_BYTES, readImageFile, readUpload, removeUpload, saveUpload, type ImageType } from "@/lib/uploads";
import { buildDrawerKickJob, buildReceiptJob, buildTestJob, buildTicketJob } from "@/lib/printing/escpos";
import { listSerialPorts, sendToPrinter, type PrinterConfig } from "@/lib/printing/transport";
import { calculateDiscountAmount, calculateOrderTotals, isDiscountEligible } from "@/lib/pricing";

type OrderInput = ReturnType<typeof createOrderSchema.parse>;
type CreditPaymentInput = ReturnType<typeof creditPaymentSchema.parse>;
type CreditPaymentMethod = CreditPaymentInput["method"];
type DiscountCreate = ReturnType<typeof discountCreateSchema.parse>;
type DiscountUpdate = ReturnType<typeof discountUpdateSchema.parse>;
type OrderAction = ReturnType<typeof orderActionSchema.parse>;
type ProductCreate = ReturnType<typeof productCreateSchema.parse>;
type ProductUpdate = ReturnType<typeof productUpdateSchema.parse>;
type IngredientCreate = ReturnType<typeof ingredientCreateSchema.parse>;
type DiningTableCreate = ReturnType<typeof diningTableCreateSchema.parse>;
type DiningTableUpdate = ReturnType<typeof diningTableUpdateSchema.parse>;
type MapShapeCreate = ReturnType<typeof mapShapeCreateSchema.parse>;
type MapShapeUpdate = ReturnType<typeof mapShapeUpdateSchema.parse>;
type InventoryMovementInput = ReturnType<typeof inventoryMovementSchema.parse>;
type SettingsUpdate = ReturnType<typeof settingsUpdateSchema.parse>;
type ProfileUpdate = ReturnType<typeof profileUpdateSchema.parse>;
type PasswordChange = ReturnType<typeof passwordChangeSchema.parse>;
type AdminPasswordReset = ReturnType<typeof adminPasswordResetSchema.parse>;
type ShiftOpen = ReturnType<typeof shiftOpenSchema.parse>;
type ShiftClose = ReturnType<typeof shiftCloseSchema.parse>;
type ExpenseFields = ReturnType<typeof expenseFieldsSchema.parse>;
type ExpenseDecision = ReturnType<typeof expenseDecisionSchema.parse>;

type DbDiscount = {
  id: number;
  name: string;
  kind: DiscountKind;
  value: number;
  min_subtotal: number;
  max_amount: number | null;
  active: number;
};

type DbOrder = {
  id: string;
  order_number: string;
  created_at: string;
  order_type: "Dine-in" | "Takeaway";
  customer_name: string | null;
  table_number: string | null;
  status: Order["status"];
  subtotal: number;
  discount_name: string | null;
  discount_kind: DiscountKind | null;
  discount_value: number | null;
  discount_amount: number;
  tax: number;
  total: number;
  note: string;
  cancel_reason: string | null;
  collected_at: string | null;
  method: Exclude<Order["paymentMethod"], "Kasbon"> | null;
  payment_status: Order["paymentStatus"];
  reference: string | null;
  cash_received: number | null;
  change_amount: number | null;
  credit_status: CreditStatus | null;
  credit_total: number | null;
  credit_paid: number | null;
};

type DbItem = {
  id: string;
  order_id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  modifier: string;
  station: "Kitchen" | "Barista";
};

type DbTicket = {
  id: string;
  order_id: string;
  station: "Kitchen" | "Barista";
  status: StationTicket["status"];
  started_at: string | null;
  ready_at: string | null;
};

type DbTicketItem = {
  ticket_id: string;
  order_item_id: string;
  quantity: number;
};

function nowIso() {
  return new Date().toISOString();
}

function getSetting(key: string, fallback: string) {
  return (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)
    ?.value ?? fallback;
}

function outletDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getProducts(): Product[] {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.category, p.price, p.icon, p.note, p.modifiers_json, p.station, p.active,
      CASE WHEN p.active = 1 AND NOT EXISTS (
        SELECT 1 FROM product_recipes r
        JOIN ingredients i ON i.id = r.ingredient_id
        WHERE r.product_id = p.id AND i.on_hand - i.reserved < r.amount_per_item
      ) THEN 1 ELSE 0 END AS available
    FROM products p
    ORDER BY p.sort_order, p.id
  `).all() as {
    id: number;
    name: string;
    category: string;
    price: number;
    icon: string;
    note: string;
    modifiers_json: string;
    station: Product["station"];
    active: number;
    available: number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    icon: row.icon,
    note: row.note,
    modifiers: JSON.parse(row.modifiers_json) as string[],
    station: row.station,
    active: row.active === 1,
    available: row.available === 1,
  }));
}

function getDiscounts(includeInactive: boolean): Discount[] {
  const rows = db.prepare(`
    SELECT id, name, kind, value, min_subtotal, max_amount, active
    FROM discounts
    ${includeInactive ? "" : "WHERE active = 1"}
    ORDER BY active DESC, name COLLATE NOCASE
  `).all() as DbDiscount[];
  return rows.map(discountFromRow);
}

function discountFromRow(row: DbDiscount): Discount {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    value: row.value,
    minSubtotal: row.min_subtotal,
    maxAmount: row.max_amount,
    active: row.active === 1,
  };
}

function getDiscountForOrderOrThrow(discountId: number, subtotal: number): Discount {
  const row = db.prepare(`
    SELECT id, name, kind, value, min_subtotal, max_amount, active
    FROM discounts WHERE id = ?
  `).get(discountId) as DbDiscount | undefined;
  if (!row || row.active !== 1) {
    throw new ApiError(400, "Diskon tidak tersedia. Pilih diskon lain atau lanjutkan tanpa diskon.", "DISCOUNT_UNAVAILABLE");
  }
  const discount = discountFromRow(row);
  if (!isDiscountEligible(discount, subtotal)) {
    throw new ApiError(400, `Diskon ${discount.name} belum memenuhi minimal belanja.`, "DISCOUNT_MIN_NOT_MET");
  }
  return discount;
}

export function getIngredients(): Ingredient[] {
  return (db.prepare(`
    SELECT id, name, unit, on_hand, reserved, minimum
    FROM ingredients
    ORDER BY name
  `).all() as {
    id: string;
    name: string;
    unit: string;
    on_hand: number;
    reserved: number;
    minimum: number;
  }[]).map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    onHand: row.on_hand,
    reserved: row.reserved,
    minimum: row.minimum,
  }));
}

function getCustomerSuggestions(limit: number, sort: "recent" | "frequent" = "recent"): CustomerSuggestion[] {
  const order = sort === "frequent"
    ? "order_count DESC, last_order_at DESC"
    : "last_order_at DESC";
  return (db.prepare(`
    SELECT name, order_count
    FROM customers
    ORDER BY ${order}
    LIMIT ?
  `).all(limit) as { name: string; order_count: number }[]).map((row) => ({
    name: row.name,
    orderCount: row.order_count,
  }));
}

function toOrderCredit(status: CreditStatus, total: number, paid: number): OrderCredit {
  const outstanding = status === "Cancelled" ? 0 : total - paid;
  return { status, total, paid, outstanding };
}

export function getOrders(user: SessionUser, orderId?: string): Order[] {
  const orderWhere = orderId ? "WHERE o.id = ?" : "";
  const orderLimit = orderId ? "" : "LIMIT 100";
  const orderRows = db.prepare(`
    SELECT o.id, o.order_number, o.created_at, o.order_type, o.customer_name, o.table_number, o.status,
      o.subtotal, o.discount_name, o.discount_kind, o.discount_value, o.discount_amount,
      o.tax, o.total, o.note, o.cancel_reason, o.collected_at,
      p.method, p.status AS payment_status, p.reference, p.cash_received, p.change_amount,
      c.status AS credit_status, c.total AS credit_total,
      COALESCE((SELECT SUM(CASE WHEN cp.kind = 'Cicilan' THEN cp.amount ELSE -cp.amount END)
        FROM credit_payments cp WHERE cp.credit_id = c.id), 0) AS credit_paid
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    LEFT JOIN credit_accounts c ON c.order_id = o.id
    ${orderWhere}
    ORDER BY o.created_at DESC
    ${orderLimit}
  `).all(...(orderId ? [orderId] : [])) as DbOrder[];
  if (orderRows.length === 0) return [];

  const ids = orderRows.map((order) => order.id);
  const placeholders = ids.map(() => "?").join(", ");
  const itemRows = db.prepare(`
    SELECT id, order_id, product_id, product_name, quantity, unit_price, modifier, station
    FROM order_items
    WHERE order_id IN (${placeholders})
    ORDER BY rowid
  `).all(...ids) as DbItem[];
  const ticketRows = db.prepare(`
    SELECT id, order_id, station, status, started_at, ready_at
    FROM station_tickets
    WHERE order_id IN (${placeholders})
    ORDER BY rowid
  `).all(...ids) as DbTicket[];
  const ticketItemRows = db.prepare(`
    SELECT ti.ticket_id, ti.order_item_id, ti.quantity
    FROM ticket_items ti
    JOIN station_tickets st ON st.id = ti.ticket_id
    WHERE st.order_id IN (${placeholders})
  `).all(...ids) as DbTicketItem[];

  const itemsByOrder = new Map<string, OrderItem[]>();
  const itemsById = new Map<string, OrderItem>();
  for (const row of itemRows) {
    const item: OrderItem = {
      id: row.id,
      productId: row.product_id,
      name: row.product_name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      modifier: row.modifier,
      station: row.station,
    };
    itemsById.set(item.id, item);
    itemsByOrder.set(row.order_id, [...(itemsByOrder.get(row.order_id) ?? []), item]);
  }

  const ticketItemsById = new Map<string, OrderItem[]>();
  for (const row of ticketItemRows) {
    const item = itemsById.get(row.order_item_id);
    if (item) ticketItemsById.set(row.ticket_id, [...(ticketItemsById.get(row.ticket_id) ?? []), { ...item, quantity: row.quantity }]);
  }

  const stationRole = user.role === "barista" ? "Barista" : user.role === "kitchen" ? "Kitchen" : null;
  const ticketsByOrder = new Map<string, StationTicket[]>();
  for (const row of ticketRows) {
    if ((user.role === "barista" && row.station !== "Barista")
      || (user.role === "kitchen" && row.station !== "Kitchen")) continue;
    const ticket: StationTicket = {
      id: row.id,
      station: row.station,
      status: row.status,
      startedAt: row.started_at,
      readyAt: row.ready_at,
      items: (ticketItemsById.get(row.id) ?? []).map((item) => ({
        ...item,
        unitPrice: stationRole ? 0 : item.unitPrice,
      })),
    };
    ticketsByOrder.set(row.order_id, [...(ticketsByOrder.get(row.order_id) ?? []), ticket]);
  }

  return orderRows.map((row) => {
    const tickets = ticketsByOrder.get(row.id) ?? [];
    const credit = row.credit_status && row.credit_total !== null
      ? toOrderCredit(row.credit_status, row.credit_total, row.credit_paid ?? 0)
      : null;
    return {
      id: row.id,
      orderNumber: row.order_number,
      createdAt: row.created_at,
      type: row.order_type,
      customerName: stationRole ? null : row.customer_name,
      table: row.table_number,
      status: row.status,
      paymentMethod: stationRole ? null : (row.method ?? (credit ? "Kasbon" : null)),
      paymentStatus: stationRole ? null : row.payment_status,
      paymentReference: stationRole ? null : row.reference,
      cashReceived: stationRole ? null : row.cash_received,
      changeAmount: stationRole ? null : row.change_amount,
      credit: stationRole ? null : credit,
      subtotal: stationRole ? null : row.subtotal,
      discountName: stationRole ? null : row.discount_name,
      discountKind: stationRole ? null : row.discount_kind,
      discountValue: stationRole ? null : row.discount_value,
      discountAmount: stationRole ? null : row.discount_amount,
      tax: stationRole ? null : row.tax,
      total: stationRole ? null : row.total,
      note: row.note,
      cancelReason: row.cancel_reason,
      collectedAt: row.collected_at,
      items: (itemsByOrder.get(row.id) ?? [])
        .filter((item) => !stationRole || item.station === stationRole)
        .map((item) => ({ ...item, unitPrice: stationRole ? 0 : item.unitPrice })),
      tickets,
    };
  });
}

function getMovements(): InventoryMovement[] {
  return (db.prepare(`
    SELECT m.id, m.ingredient_id, i.name AS ingredient_name, i.unit, m.type, m.amount, m.reason,
      u.name AS actor_name, o.order_number, m.created_at
    FROM inventory_movements m
    LEFT JOIN ingredients i ON i.id = m.ingredient_id
    JOIN users u ON u.id = m.actor_id
    LEFT JOIN orders o ON o.id = m.order_id
    ORDER BY m.created_at DESC
    LIMIT 100
  `).all() as {
    id: string;
    ingredient_id: string | null;
    ingredient_name: string | null;
    unit: string | null;
    type: InventoryMovement["type"];
    amount: number;
    reason: string;
    actor_name: string;
    order_number: string | null;
    created_at: string;
  }[]).map((row) => ({
    id: row.id,
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredient_name ?? "Bahan dihapus",
    unit: row.unit,
    type: row.type,
    amount: row.amount,
    reason: row.reason,
    actor: row.actor_name,
    orderNumber: row.order_number,
    createdAt: row.created_at,
  }));
}

export function getSummary(includeBusinessMetrics: boolean): PosSummary {
  const active = db.prepare(`
    SELECT COUNT(*) AS count FROM orders
    WHERE status IN ('Queued', 'Preparing', 'Ready for pickup')
  `).get() as { count: number };
  if (!includeBusinessMetrics) {
    return {
      todaySales: 0,
      todayOrders: 0,
      activeOrders: active.count,
      lowStockCount: 0,
      dailySales: [],
      topProducts: [],
    };
  }

  // Kasbon orders count toward revenue only through their settlements (credit_payments).
  const KASBON_ORDER_EXISTS = "EXISTS (SELECT 1 FROM credit_accounts c WHERE c.order_id = o.id)";
  const today = outletDate();
  const sales = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN ${KASBON_ORDER_EXISTS} THEN 0 ELSE o.total END), 0) AS total, COUNT(*) AS count
    FROM orders o
    WHERE date(o.created_at, '+7 hours') = ? AND o.status != 'Cancelled'
  `).get(today) as { total: number; count: number };
  const todayCredit = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN kind = 'Cicilan' THEN amount ELSE -amount END), 0) AS total
    FROM credit_payments WHERE date(created_at, '+7 hours') = ?
  `).get(today) as { total: number };
  const lowStock = db.prepare(`
    SELECT COUNT(*) AS count FROM ingredients WHERE on_hand - reserved <= minimum
  `).get() as { count: number };

  const dailyStart = outletDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const dailyRows = db.prepare(`
    SELECT date(o.created_at, '+7 hours') AS business_date,
      COALESCE(SUM(CASE WHEN ${KASBON_ORDER_EXISTS} THEN 0 ELSE o.total END), 0) AS total
    FROM orders o
    WHERE date(o.created_at, '+7 hours') BETWEEN ? AND ? AND o.status != 'Cancelled'
    GROUP BY business_date
  `).all(dailyStart, today) as { business_date: string; total: number }[];
  const dailyCreditRows = db.prepare(`
    SELECT date(created_at, '+7 hours') AS business_date,
      COALESCE(SUM(CASE WHEN kind = 'Cicilan' THEN amount ELSE -amount END), 0) AS total
    FROM credit_payments
    WHERE date(created_at, '+7 hours') BETWEEN ? AND ?
    GROUP BY business_date
  `).all(dailyStart, today) as { business_date: string; total: number }[];
  const dailyTotals = new Map(dailyRows.map((row) => [row.business_date, row.total]));
  for (const row of dailyCreditRows) {
    dailyTotals.set(row.business_date, (dailyTotals.get(row.business_date) ?? 0) + row.total);
  }
  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const date = outletDate(new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000));
    const label = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
    }).format(new Date(`${date}T12:00:00+07:00`));
    return { date, label, total: dailyTotals.get(date) ?? 0 };
  });
  const topProducts = db.prepare(`
    SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE date(o.created_at, '+7 hours') = ? AND o.status != 'Cancelled'
    GROUP BY oi.product_id, oi.product_name
    ORDER BY quantity DESC, name
    LIMIT 5
  `).all(today) as { name: string; quantity: number }[];

  return {
    todaySales: sales.total + todayCredit.total,
    todayOrders: sales.count,
    activeOrders: active.count,
    lowStockCount: lowStock.count,
    dailySales,
    topProducts,
  };
}

export function getPosBootstrap(user: SessionUser): PosBootstrap {
  const isManager = user.role === "admin";
  const canSell = user.role === "admin" || user.role === "cashier";
  const logoFile = getSetting("outlet_logo_file", "");
  const userAvatar = db.prepare("SELECT avatar_file FROM users WHERE id = ?")
    .get(user.id) as { avatar_file: string | null } | undefined;
  return {
    user,
    userAvatarUrl: avatarUrl(user.id, userAvatar?.avatar_file ?? null),
    setupCompleted: getSetting("setup_completed", "1") === "1",
    outletName: getSetting("outlet_name", "Kopi Senja"),
    outletLogoUrl: logoFile ? `/api/media/logo?v=${encodeURIComponent(logoFile)}` : null,
    taxRateBasisPoints: Number(getSetting("tax_rate_basis_points", "1000")),
    receiptWidthMm: getSetting("receipt_width_mm", "80") === "58" ? 58 : 80,
    receiptFooter: getSetting("receipt_footer", "Terima kasih telah berkunjung!"),
    printer: getPrinterSettings(),
    tablePickerMode: getTablePickerMode(),
    products: canSell ? getProducts() : [],
    tables: getDiningTables(),
    mapShapes: getMapShapes(),
    customers: canSell ? getCustomerSuggestions(50) : [],
    frequentCustomers: canSell ? getCustomerSuggestions(5, "frequent") : [],
    discounts: canSell ? getDiscounts(isManager) : [],
    ingredients: isManager ? getIngredients() : [],
    cashShift: canSell ? getOpenCashShift() : null,
    recentShifts: canSell ? getRecentCashShifts(10) : [],
    expenses: canSell ? getExpenses(100) : [],
    expenseIngredients: canSell ? getExpenseIngredients() : [],
    expensePicSuggestions: canSell ? getExpensePicSuggestions() : [],
    expenseApprovalThreshold: getExpenseApprovalThreshold(),
    kasbonLimit: getKasbonLimit(),
    receivables: canSell ? getReceivables() : [],
    orders: getOrders(user),
    movements: isManager ? getMovements() : [],
    accounts: isManager ? getAccounts() : [],
    summary: getSummary(canSell),
  };
}

function writeAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  db.prepare(`
    INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, action, entityType, entityId, JSON.stringify(details), nowIso());
}

function addMovement(input: {
  ingredientId: string;
  type: InventoryMovement["type"];
  amount: number;
  reason: string;
  actorId: string;
  orderId?: string;
  ticketId?: string;
}) {
  db.prepare(`
    INSERT INTO inventory_movements (
      id, ingredient_id, type, amount, reason, actor_id, order_id, ticket_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.ingredientId,
    input.type,
    input.amount,
    input.reason,
    input.actorId,
    input.orderId ?? null,
    input.ticketId ?? null,
    nowIso(),
  );
}

function getOrderDate() {
  return outletDate();
}

export function createPaidOrder(user: SessionUser, rawInput: unknown): string {
  const input = createOrderSchema.parse(rawInput) as OrderInput;
  const create = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM orders WHERE idempotency_key = ?")
      .get(input.idempotencyKey) as { id: string } | undefined;
    if (existing) return existing.id;

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = db.prepare(`
      SELECT id, name, category, price, modifiers_json, station, active
      FROM products
      WHERE id IN (${productIds.map(() => "?").join(", ")})
    `).all(...productIds) as {
      id: number;
      name: string;
      category: string;
      price: number;
      modifiers_json: string;
      station: "Kitchen" | "Barista";
      active: number;
    }[];
    const productsById = new Map(products.map((product) => [product.id, product]));
    const items = input.items.map((item) => {
      const product = productsById.get(item.productId);
      if (!product || product.active !== 1) {
        throw new ApiError(400, "Ada menu yang tidak tersedia.", "PRODUCT_UNAVAILABLE");
      }
      const modifiers = JSON.parse(product.modifiers_json) as string[];
      if (item.modifier && !modifiers.includes(item.modifier)) {
        throw new ApiError(400, `Pilihan ${item.modifier} tidak berlaku untuk ${product.name}.`, "INVALID_MODIFIER");
      }
      return {
        ...item,
        product,
        station: product.station,
      };
    });

    const requirements = new Map<string, number>();
    for (const item of items) {
      const recipes = db.prepare(`
        SELECT r.ingredient_id, r.amount_per_item
        FROM product_recipes r
        WHERE r.product_id = ?
      `).all(item.product.id) as { ingredient_id: string; amount_per_item: number }[];
      if (recipes.length === 0) {
        throw new ApiError(409, `Resep ${item.product.name} belum tersedia.`, "RECIPE_MISSING");
      }
      for (const recipe of recipes) {
        requirements.set(
          recipe.ingredient_id,
          (requirements.get(recipe.ingredient_id) ?? 0) + recipe.amount_per_item * item.quantity,
        );
      }
    }

    const ingredientIds = [...requirements.keys()];
    const ingredientRows = db.prepare(`
      SELECT id, name, on_hand, reserved
      FROM ingredients
      WHERE id IN (${ingredientIds.map(() => "?").join(", ")})
    `).all(...ingredientIds) as { id: string; name: string; on_hand: number; reserved: number }[];
    const ingredientsById = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
    for (const [ingredientId, amount] of requirements) {
      const ingredient = ingredientsById.get(ingredientId);
      if (!ingredient || ingredient.on_hand - ingredient.reserved < amount) {
        throw new ApiError(409, `Stok ${ingredient?.name ?? ingredientId} tidak mencukupi.`, "INSUFFICIENT_STOCK");
      }
    }

    if (input.type === "Dine-in") {
      const table = db.prepare("SELECT id FROM dining_tables WHERE name = ? COLLATE NOCASE")
        .get(input.table);
      if (!table) throw new ApiError(400, "Meja tidak ditemukan. Pilih meja dari denah.", "TABLE_NOT_FOUND");
    }

    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const discount = input.discountId === null ? null : getDiscountForOrderOrThrow(input.discountId, subtotal);
    const discountAmount = discount ? calculateDiscountAmount(discount, subtotal) : 0;
    const taxRateBasisPoints = Number(getSetting("tax_rate_basis_points", "1000"));
    const { tax, total } = calculateOrderTotals(subtotal, taxRateBasisPoints, discountAmount);
    if (input.paymentMethod === "Cash" && (input.cashReceived === null || input.cashReceived < total)) {
      throw new ApiError(400, "Nominal uang tunai kurang dari total pembayaran.", "INSUFFICIENT_CASH");
    }
    if (input.paymentMethod !== "Cash" && input.cashReceived !== null) {
      throw new ApiError(400, "Nominal uang hanya diisi untuk pembayaran tunai.", "INVALID_CASH_AMOUNT");
    }
    if (input.paymentMethod === "Kasbon") {
      const limit = getKasbonLimit();
      const outstanding = getCustomerOutstanding(input.customerName);
      if (outstanding + total > limit) {
        throw new ApiError(
          409,
          `Limit kasbon ${input.customerName} terlampaui. Sisa piutang ${formatRupiah(outstanding)}, limit ${formatRupiah(limit)}.`,
          "KASBON_LIMIT_EXCEEDED",
        );
      }
    }

    const orderId = randomUUID();
    const orderDate = getOrderDate();
    db.prepare("INSERT OR IGNORE INTO order_sequences (business_date, next_value) VALUES (?, 1)")
      .run(orderDate);
    const sequence = db.prepare("SELECT next_value FROM order_sequences WHERE business_date = ?")
      .get(orderDate) as { next_value: number };
    db.prepare("UPDATE order_sequences SET next_value = next_value + 1 WHERE business_date = ?")
      .run(orderDate);
    const orderNumber = `POS-${orderDate.replaceAll("-", "")}-${String(sequence.next_value).padStart(3, "0")}`;
    const createdAt = nowIso();
    const reference = `SIM-${randomUUID().slice(0, 8).toUpperCase()}`;

    db.prepare(`
      INSERT INTO orders (
        id, order_number, idempotency_key, created_at, order_type, customer_name, table_number, status,
        subtotal, discount_id, discount_name, discount_kind, discount_value, discount_amount,
        tax, total, note, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      orderNumber,
      input.idempotencyKey,
      createdAt,
      input.type,
      input.customerName,
      input.table,
      "Queued",
      subtotal,
      discount?.id ?? null,
      discount?.name ?? null,
      discount?.kind ?? null,
      discount?.value ?? null,
      discountAmount,
      tax,
      total,
      input.note,
      user.id,
    );
    db.prepare(`
      INSERT INTO customers (name, order_count, last_order_at) VALUES (?, 1, ?)
      ON CONFLICT(name) DO UPDATE SET order_count = order_count + 1, last_order_at = excluded.last_order_at
    `).run(input.customerName, createdAt);
    const openShift = getOpenCashShiftRow();
    if (input.paymentMethod === "Cash" && !openShift) {
      throw new ApiError(409, "Buka shift kas dulu sebelum menerima pembayaran tunai.", "SHIFT_REQUIRED");
    }
    if (input.paymentMethod === "Kasbon") {
      db.prepare(`
        INSERT INTO credit_accounts (id, order_id, customer_name, total, status, created_at)
        VALUES (?, ?, ?, ?, 'Open', ?)
      `).run(randomUUID(), orderId, input.customerName, total, createdAt);
    } else {
      db.prepare(`
        INSERT INTO payments (
          id, order_id, method, status, amount, reference, cash_received, change_amount, created_at, shift_id
        ) VALUES (?, ?, ?, 'Paid', ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        orderId,
        input.paymentMethod,
        total,
        reference,
        input.cashReceived,
        input.cashReceived === null ? null : input.cashReceived - total,
        createdAt,
        openShift?.id ?? null,
      );
    }

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, product_name, quantity, unit_price, modifier, station
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const itemsByStation = new Map<"Kitchen" | "Barista", { id: string; productId: number; quantity: number }[]>();
    for (const item of items) {
      const orderItemId = randomUUID();
      insertOrderItem.run(
        orderItemId,
        orderId,
        item.product.id,
        item.product.name,
        item.quantity,
        item.product.price,
        item.modifier,
        item.station,
      );
      itemsByStation.set(item.station, [
        ...(itemsByStation.get(item.station) ?? []),
        { id: orderItemId, productId: item.product.id, quantity: item.quantity },
      ]);
    }

    const insertTicket = db.prepare(`
      INSERT INTO station_tickets (id, order_id, station, status)
      VALUES (?, ?, ?, 'Queued')
    `);
    const insertTicketItem = db.prepare(`
      INSERT INTO ticket_items (ticket_id, order_item_id, quantity) VALUES (?, ?, ?)
    `);
    const insertReservation = db.prepare(`
      INSERT INTO ticket_reservations (id, ticket_id, ingredient_id, amount, status, created_at)
      VALUES (?, ?, ?, ?, 'Reserved', ?)
    `);
    const reserveIngredient = db.prepare(`
      UPDATE ingredients SET reserved = reserved + ?, updated_at = ?
      WHERE id = ? AND on_hand - reserved >= ?
    `);
    const requirementsByStation = new Map<"Kitchen" | "Barista", Map<string, number>>();
    for (const item of items) {
      const stationRequirements = requirementsByStation.get(item.station) ?? new Map<string, number>();
      const recipes = db.prepare(`
        SELECT ingredient_id, amount_per_item FROM product_recipes WHERE product_id = ?
      `).all(item.product.id) as { ingredient_id: string; amount_per_item: number }[];
      for (const recipe of recipes) {
        stationRequirements.set(
          recipe.ingredient_id,
          (stationRequirements.get(recipe.ingredient_id) ?? 0) + recipe.amount_per_item * item.quantity,
        );
      }
      requirementsByStation.set(item.station, stationRequirements);
    }

    for (const [station, stationItems] of itemsByStation) {
      const ticketId = randomUUID();
      insertTicket.run(ticketId, orderId, station);
      for (const item of stationItems) insertTicketItem.run(ticketId, item.id, item.quantity);
      for (const [ingredientId, amount] of requirementsByStation.get(station) ?? []) {
        const reserved = reserveIngredient.run(amount, createdAt, ingredientId, amount);
        if (reserved.changes !== 1) {
          throw new ApiError(409, "Stok berubah dan tidak lagi mencukupi. Muat ulang menu.", "INSUFFICIENT_STOCK");
        }
        insertReservation.run(randomUUID(), ticketId, ingredientId, amount, createdAt);
        addMovement({
          ingredientId,
          type: "Stock Reserved",
          amount,
          reason: `Reservasi ${station}`,
          actorId: user.id,
          orderId,
          ticketId,
        });
      }
    }

    writeAudit(user.id, "order.created", "order", orderId, {
      orderNumber,
      customerName: input.customerName,
      total,
      discount: discount ? { name: discount.name, amount: discountAmount } : null,
      itemCount: items.length,
      paymentMethod: input.paymentMethod,
    });
    return orderId;
  });

  return create();
}

function assertCanOperateStation(user: SessionUser, station: "Kitchen" | "Barista") {
  if (user.role !== "admin" && user.role !== station.toLowerCase()) {
    throw new ApiError(403, "Akun ini tidak memiliki akses ke tiket stasiun tersebut.", "FORBIDDEN");
  }
}

function updateOrderProgress(orderId: string, actorId: string) {
  const statuses = db.prepare("SELECT status FROM station_tickets WHERE order_id = ?")
    .all(orderId) as { status: StationTicket["status"] }[];
  const nextStatus: Order["status"] = statuses.length > 0 && statuses.every((ticket) => ticket.status === "Ready")
    ? "Ready for pickup"
    : statuses.some((ticket) => ticket.status === "Preparing" || ticket.status === "Ready")
      ? "Preparing"
      : "Queued";
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(nextStatus, orderId);
  writeAudit(actorId, "order.progressed", "order", orderId, { status: nextStatus });
}

export function performOrderAction(user: SessionUser, id: string, rawAction: unknown) {
  const action = orderActionSchema.parse(rawAction) as OrderAction;
  const transaction = db.transaction(() => {
    const order = db.prepare("SELECT id, status FROM orders WHERE id = ?")
      .get(id) as { id: string; status: Order["status"] } | undefined;
    if (!order) throw new ApiError(404, "Pesanan tidak ditemukan.", "ORDER_NOT_FOUND");

    if (action.action === "start") {
      assertCanOperateStation(user, action.station);
      if (order.status === "Cancelled" || order.status === "Completed") {
        throw new ApiError(409, "Pesanan ini sudah ditutup.", "ORDER_CLOSED");
      }
      const ticket = db.prepare(`
        SELECT id, status FROM station_tickets WHERE order_id = ? AND station = ?
      `).get(id, action.station) as { id: string; status: StationTicket["status"] } | undefined;
      if (!ticket) throw new ApiError(404, "Tiket stasiun tidak ditemukan.", "TICKET_NOT_FOUND");
      if (ticket.status !== "Queued") throw new ApiError(409, "Tiket tidak lagi berada dalam antrean.", "INVALID_TICKET_STATE");

      const reservations = db.prepare(`
        SELECT id, ingredient_id, amount FROM ticket_reservations
        WHERE ticket_id = ? AND status = 'Reserved'
      `).all(ticket.id) as { id: string; ingredient_id: string; amount: number }[];
      for (const reservation of reservations) {
        const changed = db.prepare(`
          UPDATE ingredients
          SET on_hand = on_hand - ?, reserved = reserved - ?, updated_at = ?
          WHERE id = ? AND on_hand >= ? AND reserved >= ?
        `).run(
          reservation.amount,
          reservation.amount,
          nowIso(),
          reservation.ingredient_id,
          reservation.amount,
          reservation.amount,
        );
        if (changed.changes !== 1) {
          throw new ApiError(409, "Stok reservasi tidak konsisten. Hubungi admin.", "RESERVATION_MISMATCH");
        }
        db.prepare("UPDATE ticket_reservations SET status = 'Consumed' WHERE id = ?").run(reservation.id);
        addMovement({
          ingredientId: reservation.ingredient_id,
          type: "Stock Out",
          amount: -reservation.amount,
          reason: `Produksi ${action.station} · mulai pesanan`,
          actorId: user.id,
          orderId: id,
          ticketId: ticket.id,
        });
      }
      db.prepare(`
        UPDATE station_tickets SET status = 'Preparing', started_at = ? WHERE id = ?
      `).run(nowIso(), ticket.id);
      updateOrderProgress(id, user.id);
      return;
    }

    if (action.action === "ready") {
      assertCanOperateStation(user, action.station);
      if (order.status === "Cancelled" || order.status === "Completed") {
        throw new ApiError(409, "Pesanan ini sudah ditutup.", "ORDER_CLOSED");
      }
      const result = db.prepare(`
        UPDATE station_tickets
        SET status = 'Ready', ready_at = ?
        WHERE order_id = ? AND station = ? AND status = 'Preparing'
      `).run(nowIso(), id, action.station);
      if (result.changes !== 1) {
        throw new ApiError(409, "Tiket harus mulai diproses sebelum ditandai siap.", "INVALID_TICKET_STATE");
      }
      updateOrderProgress(id, user.id);
      return;
    }

    if (action.action === "pickup") {
      if (user.role !== "admin" && user.role !== "cashier") {
        throw new ApiError(403, "Hanya kasir atau admin yang dapat menyelesaikan pickup.", "FORBIDDEN");
      }
      const result = db.prepare(`
        UPDATE orders SET status = 'Completed', collected_at = ?
        WHERE id = ? AND status = 'Ready for pickup'
      `).run(nowIso(), id);
      if (result.changes !== 1) {
        throw new ApiError(409, "Pesanan baru dapat diselesaikan setelah semua tiket siap.", "ORDER_NOT_READY");
      }
      writeAudit(user.id, "order.collected", "order", id);
      return;
    }

    if (user.role !== "admin") {
      throw new ApiError(403, "Hanya admin yang dapat membatalkan pesanan.", "FORBIDDEN");
    }
    if (order.status === "Completed" || order.status === "Cancelled") {
      throw new ApiError(409, "Pesanan yang sudah ditutup tidak dapat dibatalkan.", "ORDER_CLOSED");
    }
    const tickets = db.prepare("SELECT id, station FROM station_tickets WHERE order_id = ?")
      .all(id) as { id: string; station: "Kitchen" | "Barista" }[];
    const wastedIngredients: { ingredientId: string; amount: number; station: string }[] = [];
    for (const ticket of tickets) {
      const reservations = db.prepare(`
        SELECT id, ingredient_id, amount FROM ticket_reservations
        WHERE ticket_id = ? AND status = 'Reserved'
      `).all(ticket.id) as { id: string; ingredient_id: string; amount: number }[];
      for (const reservation of reservations) {
        const released = db.prepare(`
          UPDATE ingredients SET reserved = reserved - ?, updated_at = ?
          WHERE id = ? AND reserved >= ?
        `).run(reservation.amount, nowIso(), reservation.ingredient_id, reservation.amount);
        if (released.changes !== 1) {
          throw new ApiError(409, "Stok reservasi tidak konsisten. Hubungi admin.", "RESERVATION_MISMATCH");
        }
        db.prepare("UPDATE ticket_reservations SET status = 'Released' WHERE id = ?").run(reservation.id);
        addMovement({
          ingredientId: reservation.ingredient_id,
          type: "Reservation Released",
          amount: -reservation.amount,
          reason: `Reservasi dilepas · ${action.reason}`,
          actorId: user.id,
          orderId: id,
          ticketId: ticket.id,
        });
      }
      const consumedReservations = db.prepare(`
        SELECT ingredient_id, amount FROM ticket_reservations
        WHERE ticket_id = ? AND status = 'Consumed'
      `).all(ticket.id) as { ingredient_id: string; amount: number }[];
      for (const reservation of consumedReservations) {
        addMovement({
          ingredientId: reservation.ingredient_id,
          type: "Audit / Waste",
          amount: reservation.amount,
          reason: `Waste tiket ${ticket.station} · sudah tercatat sebagai Stock Out: ${action.reason}`,
          actorId: user.id,
          orderId: id,
          ticketId: ticket.id,
        });
        wastedIngredients.push({
          ingredientId: reservation.ingredient_id,
          amount: reservation.amount,
          station: ticket.station,
        });
      }
    }
    db.prepare("UPDATE station_tickets SET status = 'Cancelled' WHERE order_id = ?").run(id);
    db.prepare(`
      UPDATE orders SET status = 'Cancelled', cancel_reason = ?, cancelled_by = ? WHERE id = ?
    `).run(action.reason, user.id, id);
    const refundReference = `SIM-REFUND-${randomUUID().slice(0, 8).toUpperCase()}`;
    db.prepare(`
      UPDATE payments SET status = 'Refunded', refunded_at = ?, refund_reference = ?
      WHERE order_id = ? AND status = 'Paid'
    `).run(nowIso(), refundReference, id);
    const creditRefunds = refundCreditOnCancel(user.id, id);
    writeAudit(user.id, "order.cancelled", "order", id, {
      reason: action.reason,
      refundReference,
      creditRefunds,
      wastedIngredients,
    });
  });

  transaction();
}

export function settleCreditPayment(user: SessionUser, orderId: string, rawInput: unknown) {
  requireRole(user, ["admin", "cashier"]);
  const input = creditPaymentSchema.parse(rawInput) as CreditPaymentInput;
  const transaction = db.transaction(() => {
    const credit = db.prepare("SELECT id, status, total FROM credit_accounts WHERE order_id = ?")
      .get(orderId) as { id: string; status: CreditStatus; total: number } | undefined;
    if (!credit) throw new ApiError(404, "Pesanan ini bukan kasbon.", "KASBON_NOT_FOUND");
    if (credit.status !== "Open") throw new ApiError(409, "Kasbon ini sudah tidak aktif.", "CREDIT_CLOSED");

    const outstanding = credit.total - getCreditPaid(credit.id);
    if (input.amount > outstanding) {
      throw new ApiError(400, `Nominal melebihi sisa piutang ${formatRupiah(outstanding)}.`, "AMOUNT_EXCEEDS_OUTSTANDING");
    }
    const openShift = getOpenCashShiftRow();
    if (input.method === "Cash") {
      if (!openShift) throw new ApiError(409, "Buka shift kas dulu sebelum menerima pelunasan tunai.", "SHIFT_REQUIRED");
      if (input.cashReceived === null || input.cashReceived < input.amount) {
        throw new ApiError(400, "Nominal uang tunai kurang dari nominal pelunasan.", "INSUFFICIENT_CASH");
      }
    } else if (input.cashReceived !== null) {
      throw new ApiError(400, "Nominal uang hanya diisi untuk pembayaran tunai.", "INVALID_CASH_AMOUNT");
    }

    const createdAt = nowIso();
    db.prepare(`
      INSERT INTO credit_payments (
        id, credit_id, kind, method, amount, reference, cash_received, change_amount, shift_id, created_at, created_by
      ) VALUES (?, ?, 'Cicilan', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      credit.id,
      input.method,
      input.amount,
      `SIM-KSB-${randomUUID().slice(0, 8).toUpperCase()}`,
      input.method === "Cash" ? input.cashReceived : null,
      input.method === "Cash" && input.cashReceived !== null ? input.cashReceived - input.amount : null,
      input.method === "Cash" ? openShift?.id ?? null : null,
      createdAt,
      user.id,
    );
    const remaining = outstanding - input.amount;
    if (remaining === 0) {
      db.prepare("UPDATE credit_accounts SET status = 'Settled', settled_at = ? WHERE id = ?").run(createdAt, credit.id);
    }
    writeAudit(user.id, "credit.payment", "order", orderId, {
      amount: input.amount,
      method: input.method,
      remaining,
    });
  });

  transaction();
}

export function updateProduct(user: SessionUser, productId: number, rawUpdate: unknown) {
  const update = productUpdateSchema.parse(rawUpdate) as ProductUpdate;
  const result = db.prepare(`
    UPDATE products
    SET price = COALESCE(?, price), active = COALESCE(?, active), station = COALESCE(?, station)
    WHERE id = ?
  `).run(
    update.price ?? null,
    update.active === undefined ? null : Number(update.active),
    update.station ?? null,
    productId,
  );
  if (result.changes !== 1) throw new ApiError(404, "Menu tidak ditemukan.", "PRODUCT_NOT_FOUND");
  writeAudit(user.id, "product.updated", "product", String(productId), update);
}

export function createProduct(user: SessionUser, rawInput: unknown): number {
  const input = productCreateSchema.parse(rawInput) as ProductCreate;
  const ingredientIds = input.recipe.map((line) => line.ingredientId);
  if (new Set(ingredientIds).size !== ingredientIds.length) {
    throw new ApiError(400, "Bahan resep tidak boleh dipilih dua kali.", "DUPLICATE_RECIPE_INGREDIENT");
  }
  return db.transaction(() => {
    const duplicateName = db.prepare("SELECT id FROM products WHERE name = ? COLLATE NOCASE")
      .get(input.name);
    if (duplicateName) throw new ApiError(409, "Nama menu sudah ada.", "PRODUCT_NAME_TAKEN");

    const found = db.prepare(`
      SELECT id FROM ingredients WHERE id IN (${ingredientIds.map(() => "?").join(", ")})
    `).all(...ingredientIds) as { id: string }[];
    if (found.length !== ingredientIds.length) {
      throw new ApiError(400, "Ada bahan resep yang tidak ditemukan.", "INGREDIENT_NOT_FOUND");
    }

    const { next_sort } = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM products")
      .get() as { next_sort: number };
    const result = db.prepare(`
      INSERT INTO products (name, category, price, icon, note, modifiers_json, station, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.name,
      input.category,
      input.price,
      input.icon,
      input.note,
      JSON.stringify(input.modifiers),
      input.station,
      next_sort,
      nowIso(),
    );
    const productId = Number(result.lastInsertRowid);
    const insertRecipe = db.prepare(`
      INSERT INTO product_recipes (product_id, ingredient_id, amount_per_item) VALUES (?, ?, ?)
    `);
    for (const line of input.recipe) insertRecipe.run(productId, line.ingredientId, line.amount);
    writeAudit(user.id, "product.created", "product", String(productId), {
      name: input.name,
      price: input.price,
      station: input.station,
    });
    return productId;
  })();
}

export function createDiscount(user: SessionUser, rawInput: unknown): number {
  const input = discountCreateSchema.parse(rawInput) as DiscountCreate;
  const duplicateName = db.prepare("SELECT id FROM discounts WHERE name = ? COLLATE NOCASE").get(input.name);
  if (duplicateName) throw new ApiError(409, "Nama diskon sudah ada.", "DISCOUNT_NAME_TAKEN");
  const result = db.prepare(`
    INSERT INTO discounts (name, kind, value, min_subtotal, max_amount, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.name,
    input.kind,
    input.value,
    input.minSubtotal,
    input.maxAmount,
    Number(input.active),
    nowIso(),
  );
  const discountId = Number(result.lastInsertRowid);
  writeAudit(user.id, "discount.created", "discount", String(discountId), {
    name: input.name,
    kind: input.kind,
    value: input.value,
  });
  return discountId;
}

export function updateDiscount(user: SessionUser, discountId: number, rawUpdate: unknown) {
  const update = discountUpdateSchema.parse(rawUpdate) as DiscountUpdate;
  const result = db.prepare("UPDATE discounts SET active = ? WHERE id = ?")
    .run(Number(update.active), discountId);
  if (result.changes !== 1) throw new ApiError(404, "Diskon tidak ditemukan.", "DISCOUNT_NOT_FOUND");
  writeAudit(user.id, "discount.updated", "discount", String(discountId), update);
}

export function deleteDiscount(user: SessionUser, discountId: number) {
  const result = db.prepare("DELETE FROM discounts WHERE id = ?").run(discountId);
  if (result.changes !== 1) throw new ApiError(404, "Diskon tidak ditemukan.", "DISCOUNT_NOT_FOUND");
  writeAudit(user.id, "discount.deleted", "discount", String(discountId));
}

export function createIngredient(user: SessionUser, rawInput: unknown): string {
  const input = ingredientCreateSchema.parse(rawInput) as IngredientCreate;
  return db.transaction(() => {
    const duplicateName = db.prepare("SELECT id FROM ingredients WHERE name = ? COLLATE NOCASE")
      .get(input.name);
    if (duplicateName) throw new ApiError(409, "Nama bahan baku sudah ada.", "INGREDIENT_NAME_TAKEN");

    const id = randomUUID();
    db.prepare(`
      INSERT INTO ingredients (id, name, unit, on_hand, reserved, minimum, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, input.name, input.unit, input.initialStock, input.minimum, nowIso());
    if (input.initialStock > 0) {
      addMovement({
        ingredientId: id,
        type: "Stock In",
        amount: input.initialStock,
        reason: "Stok awal",
        actorId: user.id,
      });
    }
    writeAudit(user.id, "ingredient.created", "ingredient", id, {
      name: input.name,
      unit: input.unit,
      initialStock: input.initialStock,
    });
    return id;
  })();
}

type DiningTableRow = {
  id: number;
  name: string;
  x: number;
  y: number;
  open_order_number: string | null;
};

export function getDiningTables(): DiningTable[] {
  const rows = db.prepare(`
    SELECT t.id, t.name, t.x, t.y,
      (SELECT o.order_number FROM orders o
        WHERE o.order_type = 'Dine-in'
          AND o.table_number = t.name COLLATE NOCASE
          AND o.status NOT IN ('Completed', 'Cancelled')
        ORDER BY o.created_at
        LIMIT 1) AS open_order_number
    FROM dining_tables t
    ORDER BY t.id
  `).all() as DiningTableRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    x: row.x,
    y: row.y,
    occupied: row.open_order_number !== null,
    openOrderNumber: row.open_order_number,
  }));
}

function hasOpenDineInOrder(tableName: string) {
  return db.prepare(`
    SELECT 1 FROM orders
    WHERE order_type = 'Dine-in'
      AND table_number = ? COLLATE NOCASE
      AND status NOT IN ('Completed', 'Cancelled')
    LIMIT 1
  `).get(tableName) !== undefined;
}

function defaultTablePosition(existingCount: number) {
  return {
    x: 12 + (existingCount % 4) * 25,
    y: 15 + (Math.floor(existingCount / 4) % 4) * 25,
  };
}

function getDiningTableOrThrow(id: number) {
  const table = db.prepare("SELECT id, name, x, y FROM dining_tables WHERE id = ?")
    .get(id) as { id: number; name: string; x: number; y: number } | undefined;
  if (!table) throw new ApiError(404, "Meja tidak ditemukan.", "TABLE_NOT_FOUND");
  return table;
}

export function createDiningTable(user: SessionUser, rawInput: unknown): number {
  const input = diningTableCreateSchema.parse(rawInput) as DiningTableCreate;
  return db.transaction(() => {
    const duplicate = db.prepare("SELECT id FROM dining_tables WHERE name = ? COLLATE NOCASE").get(input.name);
    if (duplicate) throw new ApiError(409, "Nama meja sudah ada.", "TABLE_NAME_TAKEN");

    const count = (db.prepare("SELECT COUNT(*) AS total FROM dining_tables").get() as { total: number }).total;
    const position = defaultTablePosition(count);
    const now = nowIso();
    const result = db.prepare(`
      INSERT INTO dining_tables (name, x, y, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.name, input.x ?? position.x, input.y ?? position.y, now, now);
    const id = Number(result.lastInsertRowid);
    writeAudit(user.id, "table.created", "dining_table", String(id), { name: input.name });
    return id;
  })();
}

export function updateDiningTable(user: SessionUser, id: number, rawInput: unknown) {
  const input = diningTableUpdateSchema.parse(rawInput) as DiningTableUpdate;
  db.transaction(() => {
    const current = getDiningTableOrThrow(id);
    const renaming = input.name !== undefined && input.name.toLowerCase() !== current.name.toLowerCase();
    if (renaming) {
      const duplicate = db.prepare("SELECT id FROM dining_tables WHERE name = ? COLLATE NOCASE AND id <> ?")
        .get(input.name, id);
      if (duplicate) throw new ApiError(409, "Nama meja sudah ada.", "TABLE_NAME_TAKEN");
      if (hasOpenDineInOrder(current.name)) {
        throw new ApiError(409, "Meja yang sedang terisi tidak bisa diganti namanya.", "TABLE_OCCUPIED");
      }
    }
    const name = input.name ?? current.name;
    db.prepare("UPDATE dining_tables SET name = ?, x = ?, y = ?, updated_at = ? WHERE id = ?")
      .run(name, input.x ?? current.x, input.y ?? current.y, nowIso(), id);
    if (renaming) {
      writeAudit(user.id, "table.renamed", "dining_table", String(id), { from: current.name, to: name });
    }
  })();
}

export function deleteDiningTable(user: SessionUser, id: number) {
  db.transaction(() => {
    const current = getDiningTableOrThrow(id);
    if (hasOpenDineInOrder(current.name)) {
      throw new ApiError(409, "Meja yang sedang terisi tidak bisa dihapus.", "TABLE_OCCUPIED");
    }
    db.prepare("DELETE FROM dining_tables WHERE id = ?").run(id);
    writeAudit(user.id, "table.deleted", "dining_table", String(id), { name: current.name });
  })();
}

type MapShapeRow = {
  id: number;
  kind: MapShapeKind;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

const mapShapeDefaultSize: Record<MapShapeKind, { width: number; height: number }> = {
  rectangle: { width: 24, height: 16 },
  ellipse: { width: 14, height: 14 },
  wall: { width: 40, height: 2 },
  counter: { width: 26, height: 8 },
};

function getMapShapes(): MapShape[] {
  const rows = db.prepare(`
    SELECT id, kind, label, x, y, width, height
    FROM map_shapes
    ORDER BY id
  `).all() as MapShapeRow[];
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: row.label ?? "",
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
  }));
}

function getMapShapeOrThrow(id: number) {
  const shape = db.prepare("SELECT id, kind, label, x, y, width, height FROM map_shapes WHERE id = ?")
    .get(id) as MapShapeRow | undefined;
  if (!shape) throw new ApiError(404, "Bentuk denah tidak ditemukan.", "MAP_SHAPE_NOT_FOUND");
  return shape;
}

function assertMapShapeInBounds(rect: { x: number; y: number; width: number; height: number }) {
  const tolerance = 0.01;
  if (rect.x + rect.width > 100 + tolerance || rect.y + rect.height > 100 + tolerance) {
    throw new ApiError(400, "Bentuk harus berada di dalam area denah.", "SHAPE_OUT_OF_BOUNDS");
  }
}

export function createMapShape(user: SessionUser, rawInput: unknown): number {
  const input = mapShapeCreateSchema.parse(rawInput) as MapShapeCreate;
  return db.transaction(() => {
    const size = mapShapeDefaultSize[input.kind];
    const width = input.width ?? size.width;
    const height = input.height ?? size.height;
    const rect = {
      x: input.x ?? (100 - width) / 2,
      y: input.y ?? (100 - height) / 2,
      width,
      height,
    };
    assertMapShapeInBounds(rect);
    const now = nowIso();
    const result = db.prepare(`
      INSERT INTO map_shapes (kind, label, x, y, width, height, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.kind, input.label || null, rect.x, rect.y, rect.width, rect.height, now, now);
    const id = Number(result.lastInsertRowid);
    writeAudit(user.id, "map_shape.created", "map_shape", String(id), { kind: input.kind });
    return id;
  })();
}

export function updateMapShape(user: SessionUser, id: number, rawInput: unknown) {
  const input = mapShapeUpdateSchema.parse(rawInput) as MapShapeUpdate;
  db.transaction(() => {
    const current = getMapShapeOrThrow(id);
    const rect = {
      x: input.x ?? current.x,
      y: input.y ?? current.y,
      width: input.width ?? current.width,
      height: input.height ?? current.height,
    };
    assertMapShapeInBounds(rect);
    const kind = input.kind ?? current.kind;
    const label = input.label === undefined ? current.label : input.label || null;
    db.prepare(`
      UPDATE map_shapes
      SET kind = ?, label = ?, x = ?, y = ?, width = ?, height = ?, updated_at = ?
      WHERE id = ?
    `).run(kind, label, rect.x, rect.y, rect.width, rect.height, nowIso(), id);
    writeAudit(user.id, "map_shape.updated", "map_shape", String(id), { kind });
  })();
}

export function deleteMapShape(user: SessionUser, id: number) {
  db.transaction(() => {
    const current = getMapShapeOrThrow(id);
    db.prepare("DELETE FROM map_shapes WHERE id = ?").run(id);
    writeAudit(user.id, "map_shape.deleted", "map_shape", String(id), { kind: current.kind });
  })();
}

export function completeSetup(user: SessionUser) {
  db.transaction(() => {
    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE active = 1) AS products,
        (SELECT COUNT(*) FROM products p
          WHERE p.active = 1 AND NOT EXISTS (SELECT 1 FROM product_recipes r WHERE r.product_id = p.id)) AS missing_recipes,
        (SELECT COUNT(*) FROM ingredients) AS ingredients
    `).get() as { products: number; missing_recipes: number; ingredients: number };
    if (counts.ingredients === 0) {
      throw new ApiError(400, "Tambahkan minimal satu bahan baku sebelum menyelesaikan setup.", "SETUP_INCOMPLETE");
    }
    if (counts.products === 0) {
      throw new ApiError(400, "Tambahkan minimal satu menu sebelum menyelesaikan setup.", "SETUP_INCOMPLETE");
    }
    if (counts.missing_recipes > 0) {
      throw new ApiError(400, "Ada menu aktif yang belum memiliki resep.", "SETUP_INCOMPLETE");
    }
    upsertSetting("setup_completed", "1");
    writeAudit(user.id, "setup.completed", "settings", "setup_completed");
  })();
}

export function recordInventoryMovement(user: SessionUser, rawInput: unknown) {
  const input = inventoryMovementSchema.parse(rawInput) as InventoryMovementInput;
  const transaction = db.transaction(() => {
    const ingredient = db.prepare("SELECT on_hand, reserved FROM ingredients WHERE id = ?")
      .get(input.ingredientId) as { on_hand: number; reserved: number } | undefined;
    if (!ingredient) throw new ApiError(404, "Bahan baku tidak ditemukan.", "INGREDIENT_NOT_FOUND");
    if (ingredient.on_hand + input.amount < ingredient.reserved || ingredient.on_hand + input.amount < 0) {
      throw new ApiError(409, "Stok tersedia tidak cukup untuk penyesuaian ini.", "INVALID_STOCK_ADJUSTMENT");
    }
    db.prepare("UPDATE ingredients SET on_hand = on_hand + ?, updated_at = ? WHERE id = ?")
      .run(input.amount, nowIso(), input.ingredientId);
    addMovement({
      ingredientId: input.ingredientId,
      type: input.amount > 0 ? "Stock In" : "Stock Adjustment",
      amount: input.amount,
      reason: input.reason,
      actorId: user.id,
    });
    writeAudit(user.id, "inventory.adjusted", "ingredient", input.ingredientId, {
      amount: input.amount,
      reason: input.reason,
    });
  });
  transaction();
}

type DbShift = {
  id: string;
  opened_at: string;
  opening_float: number;
  closed_at: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  close_note: string;
  opened_by_name: string;
  closed_by_name: string | null;
};

type DbExpense = {
  id: string;
  created_at: string;
  shift_id: string | null;
  source: ExpenseSource;
  pic_name: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity: number;
  total: number;
  note: string;
  status: ExpenseStatus;
  created_by_name: string;
  decided_by_name: string | null;
  decided_at: string | null;
};

const cashShiftSelect = `
  SELECT s.id, s.opened_at, s.opening_float, s.closed_at, s.expected_cash, s.counted_cash,
    s.difference, s.close_note, o.name AS opened_by_name, c.name AS closed_by_name
  FROM cash_shifts s
  JOIN users o ON o.id = s.opened_by
  LEFT JOIN users c ON c.id = s.closed_by
`;

function getExpenseApprovalThreshold() {
  return Number(getSetting("expense_approval_threshold", "500000"));
}

function getTablePickerMode(): TablePickerMode {
  return getSetting("table_picker_mode", "map") === "cards" ? "cards" : "map";
}

function getOpenCashShiftRow() {
  return db.prepare(`${cashShiftSelect} WHERE s.closed_at IS NULL`).get() as DbShift | undefined;
}

function getKasbonLimit() {
  return Number(getSetting("kasbon_limit", "100000"));
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function getCreditPaid(creditId: string) {
  return (db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN kind = 'Cicilan' THEN amount ELSE -amount END), 0) AS paid
    FROM credit_payments WHERE credit_id = ?
  `).get(creditId) as { paid: number }).paid;
}

function getCustomerOutstanding(customerName: string) {
  return (db.prepare(`
    SELECT COALESCE(SUM(c.total - COALESCE((
      SELECT SUM(CASE WHEN cp.kind = 'Cicilan' THEN cp.amount ELSE -cp.amount END)
      FROM credit_payments cp WHERE cp.credit_id = c.id
    ), 0)), 0) AS outstanding
    FROM credit_accounts c
    WHERE c.status = 'Open' AND c.customer_name = ? COLLATE NOCASE
  `).get(customerName) as { outstanding: number }).outstanding;
}

export function getReceivables(): Receivable[] {
  return (db.prepare(`
    SELECT o.id, o.order_number, o.created_at, c.customer_name, c.total,
      COALESCE((
        SELECT SUM(CASE WHEN cp.kind = 'Cicilan' THEN cp.amount ELSE -cp.amount END)
        FROM credit_payments cp WHERE cp.credit_id = c.id
      ), 0) AS paid
    FROM credit_accounts c
    JOIN orders o ON o.id = c.order_id
    WHERE c.status = 'Open'
    ORDER BY o.created_at ASC
  `).all() as {
    id: string;
    order_number: string;
    created_at: string;
    customer_name: string;
    total: number;
    paid: number;
  }[]).map((row) => ({
    orderId: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    customerName: row.customer_name,
    total: row.total,
    paid: row.paid,
    outstanding: row.total - row.paid,
  }));
}

// Refunds every cicilan of a kasbon order when it is cancelled. Cash refunds leave the drawer,
// so they are booked to the open shift.
function refundCreditOnCancel(actorId: string, orderId: string) {
  const credit = db.prepare("SELECT id, status FROM credit_accounts WHERE order_id = ?")
    .get(orderId) as { id: string; status: CreditStatus } | undefined;
  if (!credit || credit.status === "Cancelled") return [];

  const cicilan = db.prepare(`
    SELECT method, amount FROM credit_payments WHERE credit_id = ? AND kind = 'Cicilan'
  `).all(credit.id) as { method: CreditPaymentMethod; amount: number }[];
  const hasCashCicilan = cicilan.some((payment) => payment.method === "Cash");
  const openShift = getOpenCashShiftRow();
  if (hasCashCicilan && !openShift) {
    throw new ApiError(409, "Buka shift kas dulu sebelum membatalkan kasbon yang sudah dibayar tunai.", "SHIFT_REQUIRED");
  }

  const createdAt = nowIso();
  const insertRefund = db.prepare(`
    INSERT INTO credit_payments (
      id, credit_id, kind, method, amount, reference, shift_id, created_at, created_by
    ) VALUES (?, ?, 'Refund', ?, ?, ?, ?, ?, ?)
  `);
  const refunds = cicilan.map((payment) => {
    const reference = `SIM-KSB-RF-${randomUUID().slice(0, 8).toUpperCase()}`;
    insertRefund.run(
      randomUUID(),
      credit.id,
      payment.method,
      payment.amount,
      reference,
      payment.method === "Cash" ? openShift?.id ?? null : null,
      createdAt,
      actorId,
    );
    return { method: payment.method, amount: payment.amount, reference };
  });
  db.prepare("UPDATE credit_accounts SET status = 'Cancelled', cancelled_at = ? WHERE id = ?")
    .run(createdAt, credit.id);
  return refunds;
}

function calculateShiftCash(
  shift: { id: string; opened_at: string; opening_float: number },
  endAt: string | null,
): CashShiftBreakdown & { expected: number } {
  const cashSales = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE shift_id = ? AND method = 'Cash'
  `).get(shift.id) as { total: number }).total + (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM credit_payments
    WHERE shift_id = ? AND method = 'Cash' AND kind = 'Cicilan'
  `).get(shift.id) as { total: number }).total;
  const cashRefunds = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM payments
    WHERE method = 'Cash' AND status = 'Refunded' AND shift_id IS NOT NULL
      AND refunded_at >= ? AND (? IS NULL OR refunded_at <= ?)
  `).get(shift.opened_at, endAt, endAt) as { total: number }).total + (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM credit_payments
    WHERE shift_id = ? AND method = 'Cash' AND kind = 'Refund'
  `).get(shift.id) as { total: number }).total;
  const drawerExpenses = (db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total FROM expenses
    WHERE shift_id = ? AND source = 'Drawer' AND status <> 'Rejected'
  `).get(shift.id) as { total: number }).total;
  return {
    cashSales,
    cashRefunds,
    drawerExpenses,
    expected: shift.opening_float + cashSales - cashRefunds - drawerExpenses,
  };
}

function cashShiftFromRow(row: DbShift): CashShift {
  const isOpen = row.closed_at === null;
  const live = isOpen ? calculateShiftCash(row, null) : null;
  return {
    id: row.id,
    openedByName: row.opened_by_name,
    openedAt: row.opened_at,
    openingFloat: row.opening_float,
    closedByName: row.closed_by_name,
    closedAt: row.closed_at,
    expectedCash: live?.expected ?? row.expected_cash ?? 0,
    breakdown: live
      ? { cashSales: live.cashSales, cashRefunds: live.cashRefunds, drawerExpenses: live.drawerExpenses }
      : null,
    countedCash: row.counted_cash,
    difference: row.difference,
    closeNote: row.close_note,
  };
}

export function getOpenCashShift(): CashShift | null {
  const row = getOpenCashShiftRow();
  return row ? cashShiftFromRow(row) : null;
}

export function getRecentCashShifts(limit: number): CashShift[] {
  const rows = db.prepare(`
    ${cashShiftSelect} WHERE s.closed_at IS NOT NULL ORDER BY s.closed_at DESC LIMIT ?
  `).all(limit) as DbShift[];
  return rows.map(cashShiftFromRow);
}

function expenseFromRow(row: DbExpense): Expense {
  return {
    id: row.id,
    createdAt: row.created_at,
    shiftId: row.shift_id,
    source: row.source,
    picName: row.pic_name,
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredient_name,
    unit: row.unit,
    quantity: row.quantity,
    total: row.total,
    note: row.note,
    receiptUrl: `/api/expenses/${encodeURIComponent(row.id)}/receipt`,
    status: row.status,
    createdByName: row.created_by_name,
    decidedByName: row.decided_by_name,
    decidedAt: row.decided_at,
  };
}

function getExpenses(limit: number): Expense[] {
  const rows = db.prepare(`
    SELECT e.id, e.created_at, e.shift_id, e.source, e.pic_name, e.ingredient_id,
      i.name AS ingredient_name, i.unit, e.quantity, e.total, e.note, e.status,
      c.name AS created_by_name, d.name AS decided_by_name, e.decided_at
    FROM expenses e
    JOIN ingredients i ON i.id = e.ingredient_id
    JOIN users c ON c.id = e.created_by
    LEFT JOIN users d ON d.id = e.decided_by
    ORDER BY e.created_at DESC
    LIMIT ?
  `).all(limit) as DbExpense[];
  return rows.map(expenseFromRow);
}

function getExpenseIngredients(): ExpenseIngredient[] {
  return db.prepare("SELECT id, name, unit FROM ingredients ORDER BY name").all() as ExpenseIngredient[];
}

function getExpensePicSuggestions(): string[] {
  const rows = db.prepare(`
    SELECT name FROM users WHERE active = 1
    UNION
    SELECT pic_name AS name FROM expenses
    ORDER BY name
    LIMIT 30
  `).all() as { name: string }[];
  return rows.map((row) => row.name);
}

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function openCashShift(user: SessionUser, rawInput: unknown) {
  requireRole(user, ["admin", "cashier"]);
  const input = shiftOpenSchema.parse(rawInput) as ShiftOpen;
  const transaction = db.transaction(() => {
    if (getOpenCashShiftRow()) {
      throw new ApiError(409, "Shift kas masih terbuka.", "SHIFT_ALREADY_OPEN");
    }
    const shiftId = randomUUID();
    db.prepare(`
      INSERT INTO cash_shifts (id, opened_by, opened_at, opening_float, open_key) VALUES (?, ?, ?, ?, 1)
    `).run(shiftId, user.id, nowIso(), input.openingFloat);
    writeAudit(user.id, "cash_shift.opened", "cash_shift", shiftId, { openingFloat: input.openingFloat });
  });
  transaction();
}

export function closeCashShift(user: SessionUser, rawInput: unknown) {
  requireRole(user, ["admin", "cashier"]);
  const input = shiftCloseSchema.parse(rawInput) as ShiftClose;
  const transaction = db.transaction(() => {
    const open = getOpenCashShiftRow();
    if (!open) throw new ApiError(409, "Tidak ada shift kas yang terbuka.", "SHIFT_NOT_OPEN");
    const closedAt = nowIso();
    const { expected } = calculateShiftCash(open, closedAt);
    const difference = input.countedCash - expected;
    db.prepare(`
      UPDATE cash_shifts
      SET closed_by = ?, closed_at = ?, expected_cash = ?, counted_cash = ?, difference = ?,
        close_note = ?, open_key = NULL
      WHERE id = ?
    `).run(user.id, closedAt, expected, input.countedCash, difference, input.closeNote, open.id);
    writeAudit(user.id, "cash_shift.closed", "cash_shift", open.id, {
      expectedCash: expected,
      countedCash: input.countedCash,
      difference,
    });
  });
  transaction();
}

export async function createExpense(user: SessionUser, formData: FormData) {
  requireRole(user, ["admin", "cashier"]);
  const input = expenseFieldsSchema.parse({
    source: formText(formData, "source"),
    picName: formText(formData, "picName"),
    ingredientId: formText(formData, "ingredientId"),
    quantity: Number(formText(formData, "quantity")),
    total: Number(formText(formData, "total")),
    note: formText(formData, "note"),
  }) as ExpenseFields;
  const receipt = formData.get("receipt");
  if (!(receipt instanceof File)) {
    throw new ApiError(400, "Foto nota wajib dilampirkan.", "RECEIPT_REQUIRED");
  }
  const image = await readImageFile(receipt, MAX_RECEIPT_BYTES);

  const ingredient = db.prepare("SELECT id, name, unit FROM ingredients WHERE id = ?")
    .get(input.ingredientId) as { id: string; name: string; unit: string } | undefined;
  if (!ingredient) throw new ApiError(404, "Bahan baku tidak ditemukan.", "INGREDIENT_NOT_FOUND");
  const openShift = getOpenCashShiftRow();
  if (input.source === "Drawer" && !openShift) {
    throw new ApiError(409, "Buka shift kas dulu untuk belanja dari laci.", "SHIFT_REQUIRED");
  }
  const status: ExpenseStatus = input.total > getExpenseApprovalThreshold() ? "Pending" : "Approved";

  const receiptFile = await saveUpload("receipts", "receipt", image.buffer, image.type);
  try {
    db.transaction(() => {
      const expenseId = randomUUID();
      const createdAt = nowIso();
      db.prepare(`
        INSERT INTO expenses (
          id, shift_id, source, pic_name, ingredient_id, quantity, total, note, receipt_file,
          status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        expenseId,
        input.source === "Drawer" ? openShift?.id ?? null : null,
        input.source,
        input.picName,
        input.ingredientId,
        input.quantity,
        input.total,
        input.note,
        receiptFile,
        status,
        user.id,
        createdAt,
      );
      db.prepare("UPDATE ingredients SET on_hand = on_hand + ?, updated_at = ? WHERE id = ?")
        .run(input.quantity, createdAt, input.ingredientId);
      addMovement({
        ingredientId: input.ingredientId,
        type: "Stock In",
        amount: input.quantity,
        reason: `Belanja ${input.picName}${input.note ? ` · ${input.note}` : ""}`,
        actorId: user.id,
      });
      writeAudit(user.id, "expense.created", "expense", expenseId, {
        ingredient: ingredient.name,
        quantity: input.quantity,
        total: input.total,
        source: input.source,
        status,
      });
    })();
  } catch (error) {
    await removeUpload("receipts", receiptFile);
    throw error;
  }
}

export function decideExpense(user: SessionUser, expenseId: string, rawInput: unknown) {
  requireRole(user, ["admin"]);
  const input = expenseDecisionSchema.parse(rawInput) as ExpenseDecision;
  const transaction = db.transaction(() => {
    const expense = db.prepare(`
      SELECT id, status, ingredient_id, quantity, total FROM expenses WHERE id = ?
    `).get(expenseId) as {
      id: string;
      status: ExpenseStatus;
      ingredient_id: string;
      quantity: number;
      total: number;
    } | undefined;
    if (!expense) throw new ApiError(404, "Data belanja tidak ditemukan.", "EXPENSE_NOT_FOUND");
    if (expense.status !== "Pending") {
      throw new ApiError(409, "Belanja ini sudah diputuskan.", "EXPENSE_NOT_PENDING");
    }

    const decidedAt = nowIso();
    if (input.action === "reject") {
      const ingredient = db.prepare("SELECT on_hand, reserved FROM ingredients WHERE id = ?")
        .get(expense.ingredient_id) as { on_hand: number; reserved: number };
      if (ingredient.on_hand - expense.quantity < ingredient.reserved) {
        throw new ApiError(
          409,
          "Stok dari belanja ini sudah dipakai pesanan, sehingga tidak bisa ditolak.",
          "EXPENSE_STOCK_IN_USE",
        );
      }
      db.prepare("UPDATE ingredients SET on_hand = on_hand - ?, updated_at = ? WHERE id = ?")
        .run(expense.quantity, decidedAt, expense.ingredient_id);
      addMovement({
        ingredientId: expense.ingredient_id,
        type: "Stock Adjustment",
        amount: -expense.quantity,
        reason: "Pembatalan belanja yang ditolak admin",
        actorId: user.id,
      });
    }

    db.prepare(`
      UPDATE expenses SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?
    `).run(input.action === "approve" ? "Approved" : "Rejected", user.id, decidedAt, expense.id);
    writeAudit(user.id, `expense.${input.action === "approve" ? "approved" : "rejected"}`, "expense", expense.id, {
      total: expense.total,
    });
  });
  transaction();
}

export async function getExpenseReceipt(user: SessionUser, expenseId: string) {
  requireRole(user, ["admin", "cashier"]);
  const row = db.prepare("SELECT receipt_file FROM expenses WHERE id = ?").get(expenseId) as
    | { receipt_file: string }
    | undefined;
  if (!row) throw new ApiError(404, "Foto nota tidak ditemukan.", "EXPENSE_NOT_FOUND");
  return readUpload("receipts", row.receipt_file);
}

function upsertSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

function avatarUrl(userId: string, avatarFile: string | null) {
  return avatarFile ? `/api/media/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(avatarFile)}` : null;
}

function getAccounts(): ManagedAccount[] {
  const rows = db.prepare(`
    SELECT id, name, username, role, avatar_file
    FROM users
    WHERE active = 1
    ORDER BY created_at, id
  `).all() as { id: string; name: string; username: string; role: UserRole; avatar_file: string | null }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    avatarUrl: avatarUrl(row.id, row.avatar_file),
  }));
}

export function updateSettings(user: SessionUser, rawUpdate: unknown) {
  const update = settingsUpdateSchema.parse(rawUpdate) as SettingsUpdate;
  if (update.outletName !== undefined) upsertSetting("outlet_name", update.outletName);
  if (update.receiptWidthMm !== undefined) upsertSetting("receipt_width_mm", String(update.receiptWidthMm));
  if (update.taxRateBasisPoints !== undefined) {
    upsertSetting("tax_rate_basis_points", String(update.taxRateBasisPoints));
  }
  if (update.receiptFooter !== undefined) upsertSetting("receipt_footer", update.receiptFooter);
  if (update.printerMode !== undefined) upsertSetting("printer_mode", update.printerMode);
  if (update.printerHost !== undefined) upsertSetting("printer_host", update.printerHost);
  if (update.printerPort !== undefined) upsertSetting("printer_port", String(update.printerPort));
  if (update.printerSystemName !== undefined) upsertSetting("printer_system_name", update.printerSystemName);
  if (update.printerSerialPath !== undefined) upsertSetting("printer_serial_path", update.printerSerialPath);
  if (update.printerBaudRate !== undefined) upsertSetting("printer_baud_rate", String(update.printerBaudRate));
  if (update.drawerAutoOpen !== undefined) upsertSetting("drawer_auto_open", update.drawerAutoOpen ? "1" : "0");
  if (update.expenseApprovalThreshold !== undefined) {
    upsertSetting("expense_approval_threshold", String(update.expenseApprovalThreshold));
  }
  if (update.tablePickerMode !== undefined) upsertSetting("table_picker_mode", update.tablePickerMode);
  if (update.kasbonLimit !== undefined) upsertSetting("kasbon_limit", String(update.kasbonLimit));
  writeAudit(user.id, "settings.updated", "settings", "store", update);
}

export async function updateStoreLogo(user: SessionUser, image: { buffer: Buffer; type: ImageType }) {
  const previous = getSetting("outlet_logo_file", "");
  const filename = await saveUpload("store", "logo", image.buffer, image.type);
  upsertSetting("outlet_logo_file", filename);
  await removeUpload("store", previous);
  writeAudit(user.id, "settings.logo_updated", "settings", "outlet_logo_file", { mime: image.type.mime });
}

export async function removeStoreLogo(user: SessionUser) {
  const previous = getSetting("outlet_logo_file", "");
  db.prepare("DELETE FROM settings WHERE key = 'outlet_logo_file'").run();
  await removeUpload("store", previous);
  writeAudit(user.id, "settings.logo_removed", "settings", "outlet_logo_file");
}

export function updateOwnProfile(user: SessionUser, rawUpdate: unknown) {
  const update = profileUpdateSchema.parse(rawUpdate) as ProfileUpdate;
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(update.name, user.id);
  writeAudit(user.id, "account.profile_updated", "user", user.id, { name: update.name });
}

export async function updateOwnAvatar(user: SessionUser, image: { buffer: Buffer; type: ImageType }) {
  const previous = db.prepare("SELECT avatar_file FROM users WHERE id = ?")
    .get(user.id) as { avatar_file: string | null } | undefined;
  const filename = await saveUpload("avatars", "avatar", image.buffer, image.type);
  db.prepare("UPDATE users SET avatar_file = ? WHERE id = ?").run(filename, user.id);
  await removeUpload("avatars", previous?.avatar_file);
  writeAudit(user.id, "account.avatar_updated", "user", user.id, { mime: image.type.mime });
}

export async function removeOwnAvatar(user: SessionUser) {
  const previous = db.prepare("SELECT avatar_file FROM users WHERE id = ?")
    .get(user.id) as { avatar_file: string | null } | undefined;
  db.prepare("UPDATE users SET avatar_file = NULL WHERE id = ?").run(user.id);
  await removeUpload("avatars", previous?.avatar_file);
  writeAudit(user.id, "account.avatar_removed", "user", user.id);
}

export async function changeOwnPassword(user: SessionUser, rawInput: unknown) {
  const input = passwordChangeSchema.parse(rawInput) as PasswordChange;
  if (input.currentPassword === input.newPassword) {
    throw new ApiError(400, "Password baru harus berbeda dari password saat ini.", "PASSWORD_UNCHANGED");
  }
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ? AND active = 1")
    .get(user.id) as { password_hash: string } | undefined;
  if (!row || !(await bcrypt.compare(input.currentPassword, row.password_hash))) {
    throw new ApiError(400, "Password saat ini tidak sesuai.", "INVALID_CURRENT_PASSWORD");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 11);
  return db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?")
      .run(passwordHash, user.id);
    writeAudit(user.id, "account.password_changed", "user", user.id);
    const { token_version } = db.prepare("SELECT token_version FROM users WHERE id = ?")
      .get(user.id) as { token_version: number };
    return token_version;
  })();
}

export async function readStoreLogo() {
  const filename = getSetting("outlet_logo_file", "");
  if (!filename) throw new ApiError(404, "Logo belum diatur.", "LOGO_NOT_FOUND");
  return readUpload("store", filename).catch(() => {
    throw new ApiError(404, "Logo belum diatur.", "LOGO_NOT_FOUND");
  });
}

export async function readAvatar(userId: string) {
  const row = db.prepare("SELECT avatar_file FROM users WHERE id = ? AND active = 1")
    .get(userId) as { avatar_file: string | null } | undefined;
  if (!row?.avatar_file) throw new ApiError(404, "Foto profil belum diatur.", "AVATAR_NOT_FOUND");
  return readUpload("avatars", row.avatar_file).catch(() => {
    throw new ApiError(404, "Foto profil belum diatur.", "AVATAR_NOT_FOUND");
  });
}

export async function resetAccountPassword(admin: SessionUser, targetId: string, rawInput: unknown) {
  const input = adminPasswordResetSchema.parse(rawInput) as AdminPasswordReset;
  if (targetId === admin.id) {
    throw new ApiError(400, "Gunakan menu Ganti password untuk akun sendiri.", "USE_SELF_SERVICE");
  }
  const target = db.prepare("SELECT id FROM users WHERE id = ? AND active = 1").get(targetId);
  if (!target) throw new ApiError(404, "Akun tidak ditemukan.", "ACCOUNT_NOT_FOUND");

  const passwordHash = await bcrypt.hash(input.newPassword, 11);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?")
      .run(passwordHash, targetId);
    writeAudit(admin.id, "account.password_reset", "user", targetId);
  })();
}

export function getOrderForUser(user: SessionUser, id: string): Order {
  const order = getOrders(user, id)[0];
  if (!order) throw new ApiError(404, "Pesanan tidak ditemukan.", "ORDER_NOT_FOUND");
  return order;
}

export function requireRole(user: SessionUser, roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "Akun ini tidak memiliki izin untuk tindakan tersebut.", "FORBIDDEN");
  }
}

function getPrinterSettings(): PrinterSettings {
  const mode = getSetting("printer_mode", "off");
  const port = Number(getSetting("printer_port", "9100"));
  const baudRate = Number(getSetting("printer_baud_rate", "9600"));
  return {
    mode: mode === "network" || mode === "system" || mode === "serial" ? mode : "off",
    host: getSetting("printer_host", ""),
    port: Number.isInteger(port) && port > 0 ? port : 9100,
    systemName: getSetting("printer_system_name", ""),
    serialPath: getSetting("printer_serial_path", ""),
    baudRate: (PRINTER_BAUD_RATES as readonly number[]).includes(baudRate) ? baudRate : 9600,
    drawerAutoOpen: getSetting("drawer_auto_open", "1") === "1",
  };
}

function getPrinterConfig(): PrinterConfig {
  const settings = getPrinterSettings();
  if (settings.mode === "off") {
    throw new ApiError(409, "Printer server belum diatur di Pengaturan.", "PRINTER_DISABLED");
  }
  if (settings.mode === "network") {
    if (!settings.host) throw new ApiError(409, "Alamat IP printer belum diisi di Pengaturan.", "PRINTER_NOT_CONFIGURED");
    return { mode: "network", host: settings.host, port: settings.port };
  }
  if (settings.mode === "serial") {
    if (!settings.serialPath) throw new ApiError(409, "Port serial printer belum diisi di Pengaturan.", "PRINTER_NOT_CONFIGURED");
    return { mode: "serial", path: settings.serialPath, baudRate: settings.baudRate };
  }
  if (!settings.systemName) throw new ApiError(409, "Nama printer sistem belum diisi di Pengaturan.", "PRINTER_NOT_CONFIGURED");
  return { mode: "system", systemName: settings.systemName };
}

function getReceiptPrintSettings() {
  const width: 58 | 80 = getSetting("receipt_width_mm", "80") === "58" ? 58 : 80;
  return {
    width,
    outletName: getSetting("outlet_name", "Kopi Senja"),
    footer: getSetting("receipt_footer", "Terima kasih telah berkunjung!"),
  };
}

function buildOrderPrintJobs(user: SessionUser, orderId: string) {
  requireRole(user, ["admin", "cashier"]);
  const order = getOrderForUser(user, orderId);
  const print = getReceiptPrintSettings();
  const activeTickets = order.tickets.filter((ticket) => ticket.status !== "Cancelled");
  const jobs = [
    buildReceiptJob({ width: print.width, outletName: print.outletName, footer: print.footer, order }),
    ...activeTickets.map((ticket) =>
      buildTicketJob({ width: print.width, outletName: print.outletName, order, ticket })),
  ];
  return { order, jobs };
}

export async function printOrderDocuments(user: SessionUser, orderId: string) {
  const config = getPrinterConfig();
  const { order, jobs } = buildOrderPrintJobs(user, orderId);
  await sendToPrinter(config, Buffer.concat(jobs));
  writeAudit(user.id, "order.printed", "order", order.id, { documents: jobs.length });
  return { documents: jobs.length };
}

// Byte ESC/POS untuk dikirim browser ke printer Bluetooth yang terhubung di perangkat kasir.
export function getOrderPrintBytes(user: SessionUser, orderId: string) {
  const { order, jobs } = buildOrderPrintJobs(user, orderId);
  writeAudit(user.id, "order.printed", "order", order.id, { documents: jobs.length, channel: "browser-bluetooth" });
  return { documents: jobs.length, data: Buffer.concat(jobs).toString("base64") };
}

export async function printTestPage(user: SessionUser) {
  requireRole(user, ["admin"]);
  const config = getPrinterConfig();
  const print = getReceiptPrintSettings();
  await sendToPrinter(config, buildTestJob({ width: print.width, outletName: print.outletName }));
  return { documents: 1 };
}

export function listPrinterPorts(user: SessionUser) {
  requireRole(user, ["admin"]);
  return listSerialPorts();
}

export async function openCashDrawer(user: SessionUser) {
  requireRole(user, ["admin", "cashier"]);
  const config = getPrinterConfig();
  await sendToPrinter(config, buildDrawerKickJob());
  writeAudit(user.id, "cash_drawer.opened", "cash_drawer", "drawer", { channel: config.mode });
  return { opened: true };
}

// Dipanggil setelah pembayaran tunai. Gagal membuka laci tidak membatalkan transaksi.
export async function autoOpenDrawerAfterCashSale(user: SessionUser) {
  if (getSetting("printer_mode", "off") === "off" || getSetting("drawer_auto_open", "1") !== "1") {
    return { opened: false, warning: null };
  }
  try {
    await openCashDrawer(user);
    return { opened: true, warning: null };
  } catch (error) {
    const warning = error instanceof ApiError ? error.message : "Laci kasir tidak bisa dibuka otomatis.";
    return { opened: false, warning };
  }
}
