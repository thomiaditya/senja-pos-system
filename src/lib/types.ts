export type UserRole = "admin" | "cashier" | "barista" | "kitchen";

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
};

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  icon: string;
  note: string;
  modifiers: string[];
  station: "Kitchen" | "Barista";
  active: boolean;
  available: boolean;
};

export type OpenTabSummary = {
  id: string;
  customerName: string;
  openedAt: string;
  orderCount: number;
  total: number;
};

export type TabDetail = {
  id: string;
  tableName: string;
  customerName: string;
  status: "Open" | "Closed";
  openedAt: string;
  closedAt: string | null;
  paymentMethod: "Cash" | "QRIS" | "Debit/Kredit" | "Kasbon" | null;
  total: number;
  cashReceived: number | null;
  changeAmount: number | null;
  orders: Order[];
};

export type DiningTable = {
  id: number;
  name: string;
  x: number;
  y: number;
  occupied: boolean;
  openOrderNumber: string | null;
  openTab: OpenTabSummary | null;
};

export type MapShapeKind = "rectangle" | "ellipse" | "wall" | "counter";

export type MapShape = {
  id: number;
  kind: MapShapeKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  reserved: number;
  minimum: number;
};

export type OrderItem = {
  id: string;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  modifier: string;
  station: "Kitchen" | "Barista";
};

export type StationTicket = {
  id: string;
  station: "Kitchen" | "Barista";
  status: "Queued" | "Preparing" | "Ready" | "Cancelled";
  startedAt: string | null;
  readyAt: string | null;
  items: OrderItem[];
};

export type CustomerSuggestion = {
  name: string;
  orderCount: number;
};

export type CreditStatus = "Open" | "Settled" | "Cancelled";

export type OrderCredit = {
  status: CreditStatus;
  total: number;
  paid: number;
  outstanding: number;
};

export type OrderCancelRequest = {
  reason: string;
  requestedAt: string;
};

export type PendingCancelRequest = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderType: Order["type"];
  table: string | null;
  customerName: string | null;
  orderStatus: Order["status"];
  total: number;
  reason: string;
  requestedByName: string;
  requestedAt: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  createdAt: string;
  type: "Dine-in" | "Takeaway";
  customerName: string | null;
  table: string | null;
  tabId: string | null;
  status: "Queued" | "Preparing" | "Ready for pickup" | "Completed" | "Cancelled";
  paymentMethod: "Cash" | "QRIS" | "Debit/Kredit" | "Kasbon" | null;
  paymentStatus: "Paid" | "Refunded" | null;
  paymentReference: string | null;
  cashReceived: number | null;
  changeAmount: number | null;
  credit: OrderCredit | null;
  subtotal: number | null;
  discountName: string | null;
  discountKind: DiscountKind | null;
  discountValue: number | null;
  discountAmount: number | null;
  tax: number | null;
  total: number | null;
  note: string;
  cancelReason: string | null;
  cancelRequest: OrderCancelRequest | null;
  collectedAt: string | null;
  items: OrderItem[];
  tickets: StationTicket[];
};

export type DiscountKind = "Percent" | "Fixed";

export type Discount = {
  id: number;
  name: string;
  kind: DiscountKind;
  value: number;
  minSubtotal: number;
  maxAmount: number | null;
  active: boolean;
};

export type CashShiftBreakdown = {
  cashSales: number;
  cashRefunds: number;
  drawerExpenses: number;
};

export type CashShift = {
  id: string;
  openedByName: string;
  openedAt: string;
  openingFloat: number;
  closedByName: string | null;
  closedAt: string | null;
  expectedCash: number;
  breakdown: CashShiftBreakdown | null;
  countedCash: number | null;
  difference: number | null;
  closeNote: string;
};

export type ExpenseSource = "Drawer" | "Non-cash";
export type ExpenseStatus = "Pending" | "Approved" | "Rejected";

export type Expense = {
  id: string;
  createdAt: string;
  shiftId: string | null;
  source: ExpenseSource;
  picName: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  total: number;
  note: string;
  receiptUrl: string;
  status: ExpenseStatus;
  createdByName: string;
  decidedByName: string | null;
  decidedAt: string | null;
};

export type ExpenseIngredient = {
  id: string;
  name: string;
  unit: string;
};

export type InventoryMovement = {
  id: string;
  ingredientId: string | null;
  ingredientName: string;
  unit: string | null;
  type: "Stock In" | "Stock Reserved" | "Stock Out" | "Stock Adjustment" | "Reservation Released" | "Audit / Waste";
  amount: number;
  reason: string;
  actor: string;
  orderNumber: string | null;
  createdAt: string;
};

export type PosSummary = {
  todaySales: number;
  todayOrders: number;
  activeOrders: number;
  lowStockCount: number;
  dailySales: { date: string; label: string; total: number }[];
  topProducts: { name: string; quantity: number }[];
};

export type ManagedAccount = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatarUrl: string | null;
};

export type PrinterMode = "off" | "network" | "system" | "serial";
export type TablePickerMode = "map" | "cards";

export const PRINTER_BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const;

export type PrinterSerialPort = {
  path: string;
  manufacturer: string;
  isBluetooth: boolean;
};

export type PrinterSettings = {
  mode: PrinterMode;
  host: string;
  port: number;
  systemName: string;
  serialPath: string;
  baudRate: number;
  drawerAutoOpen: boolean;
};

export type Receivable = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  total: number;
  paid: number;
  outstanding: number;
};

export type PosBootstrap = {
  user: SessionUser;
  userAvatarUrl: string | null;
  setupCompleted: boolean;
  outletName: string;
  outletLogoUrl: string | null;
  taxRateBasisPoints: number;
  receiptWidthMm: 58 | 80;
  receiptFooter: string;
  printer: PrinterSettings;
  tablePickerMode: TablePickerMode;
  products: Product[];
  tables: DiningTable[];
  mapShapes: MapShape[];
  customers: CustomerSuggestion[];
  frequentCustomers: CustomerSuggestion[];
  discounts: Discount[];
  ingredients: Ingredient[];
  cashShift: CashShift | null;
  recentShifts: CashShift[];
  expenses: Expense[];
  expenseIngredients: ExpenseIngredient[];
  expensePicSuggestions: string[];
  expenseApprovalThreshold: number;
  kasbonLimit: number;
  receivables: Receivable[];
  orders: Order[];
  cancelRequests: PendingCancelRequest[];
  movements: InventoryMovement[];
  accounts: ManagedAccount[];
  summary: PosSummary;
};
