import { z } from "zod";
import { PRINTER_BAUD_RATES } from "@/lib/types";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

const orderLinesSchema = z.array(z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(50),
  modifier: z.string().trim().max(80),
})).min(1).max(30);

const paymentMethodSchema = z.enum(["Cash", "QRIS", "Debit/Kredit", "Kasbon"]);

export const createOrderSchema = z.object({
  idempotencyKey: z.uuid(),
  type: z.enum(["Dine-in", "Takeaway"]),
  customerName: z.string().trim().min(1, "Nama pelanggan wajib diisi.").max(60),
  table: z.string().trim().min(1).max(32).nullable(),
  paymentMethod: paymentMethodSchema,
  cashReceived: z.number().int().nonnegative().nullable(),
  discountId: z.number().int().positive().nullable(),
  note: z.string().trim().max(240),
  items: orderLinesSchema,
}).refine(
  (order) => (order.type === "Dine-in" ? Boolean(order.table) : order.table === null),
  { message: "Pesanan dine-in memerlukan meja; takeaway tidak menggunakan meja." },
);

export const tabOpenSchema = z.object({
  idempotencyKey: z.uuid(),
  table: z.string().trim().min(1).max(32),
  customerName: z.string().trim().min(1, "Nama pelanggan wajib diisi.").max(60),
  discountId: z.number().int().positive().nullable(),
  note: z.string().trim().max(240),
  items: orderLinesSchema,
});

export const tabOrderSchema = z.object({
  idempotencyKey: z.uuid(),
  discountId: z.number().int().positive().nullable(),
  note: z.string().trim().max(240),
  items: orderLinesSchema,
});

export const tabCloseSchema = z.object({
  paymentMethod: paymentMethodSchema,
  cashReceived: z.number().int().nonnegative().nullable(),
});

export const creditPaymentSchema = z.object({
  amount: z.number().int().positive().max(100_000_000_000),
  method: z.enum(["Cash", "QRIS", "Debit/Kredit"]),
  cashReceived: z.number().int().nonnegative().nullable(),
});

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), station: z.enum(["Kitchen", "Barista"]) }),
  z.object({ action: z.literal("ready"), station: z.enum(["Kitchen", "Barista"]) }),
  z.object({ action: z.literal("pickup") }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(160) }),
]);

export const productUpdateSchema = z.object({
  price: z.number().int().min(1000).max(100_000_000).optional(),
  active: z.boolean().optional(),
  station: z.enum(["Kitchen", "Barista"]).optional(),
}).refine((value) => value.price !== undefined || value.active !== undefined || value.station !== undefined);

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(40),
  price: z.number().int().min(1000).max(100_000_000),
  station: z.enum(["Kitchen", "Barista"]),
  icon: z.string().trim().max(8),
  note: z.string().trim().max(60),
  modifiers: z.array(z.string().trim().min(1).max(40)).max(10),
  recipe: z.array(z.object({
    ingredientId: z.string().min(1).max(64),
    amount: z.number().positive().max(100_000),
  })).min(1, "Setiap menu harus memiliki minimal satu bahan resep.").max(20),
});

export const discountCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.enum(["Percent", "Fixed"]),
  value: z.number().int().positive().max(100_000_000),
  minSubtotal: z.number().int().nonnegative().max(100_000_000),
  maxAmount: z.number().int().positive().max(100_000_000).nullable(),
  active: z.boolean(),
}).superRefine((discount, ctx) => {
  if (discount.kind === "Percent" && discount.value > 100) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Diskon persentase maksimal 100%." });
  }
  if (discount.kind === "Fixed" && discount.maxAmount !== null) {
    ctx.addIssue({ code: "custom", path: ["maxAmount"], message: "Batas maksimal hanya untuk diskon persentase." });
  }
});

export const discountUpdateSchema = z.object({ active: z.boolean() });

export const ingredientCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(12),
  initialStock: z.number().nonnegative().max(10_000_000),
  minimum: z.number().nonnegative().max(10_000_000),
});

const tableCoordinate = z.number().finite().min(0).max(100);

export const diningTableCreateSchema = z.object({
  name: z.string().trim().min(1).max(32),
  x: tableCoordinate.optional(),
  y: tableCoordinate.optional(),
});

export const diningTableUpdateSchema = z.object({
  name: z.string().trim().min(1).max(32).optional(),
  x: tableCoordinate.optional(),
  y: tableCoordinate.optional(),
}).refine(
  (value) => value.name !== undefined || value.x !== undefined || value.y !== undefined,
  { message: "Tidak ada perubahan meja." },
);

export const mapShapeKinds = ["rectangle", "ellipse", "wall", "counter"] as const;
const mapShapeSize = z.number().finite().min(2).max(100);

export const mapShapeCreateSchema = z.object({
  kind: z.enum(mapShapeKinds),
  label: z.string().trim().max(32).optional(),
  x: tableCoordinate.optional(),
  y: tableCoordinate.optional(),
  width: mapShapeSize.optional(),
  height: mapShapeSize.optional(),
});

export const mapShapeUpdateSchema = z.object({
  kind: z.enum(mapShapeKinds).optional(),
  label: z.string().trim().max(32).optional(),
  x: tableCoordinate.optional(),
  y: tableCoordinate.optional(),
  width: mapShapeSize.optional(),
  height: mapShapeSize.optional(),
}).refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  { message: "Tidak ada perubahan bentuk." },
);

export const inventoryMovementSchema = z.object({
  ingredientId: z.string().min(1).max(64),
  amount: z.number().finite().refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(160),
});

export const shiftOpenSchema = z.object({
  openingFloat: z.number().int().min(0).max(100_000_000),
});

export const shiftCloseSchema = z.object({
  countedCash: z.number().int().min(0).max(100_000_000_000),
  closeNote: z.string().trim().max(240).default(""),
});

export const expenseFieldsSchema = z.object({
  source: z.enum(["Drawer", "Non-cash"]),
  picName: z.string().trim().min(1).max(60),
  ingredientId: z.string().trim().min(1).max(64),
  quantity: z.number().positive().max(1_000_000),
  total: z.number().int().positive().max(100_000_000_000),
  note: z.string().trim().max(240).default(""),
});

export const expenseDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const settingsUpdateSchema = z
  .object({
    outletName: z.string().trim().min(3).max(60).optional(),
    expenseApprovalThreshold: z.number().int().min(0).max(100_000_000_000).optional(),
    kasbonLimit: z.number().int().min(0).max(100_000_000_000).optional(),
    receiptWidthMm: z.union([z.literal(58), z.literal(80)]).optional(),
    taxRateBasisPoints: z.number().int().min(0).max(3000).optional(),
    receiptFooter: z.string().trim().max(120).optional(),
    printerMode: z.enum(["off", "network", "system", "serial"]).optional(),
    printerHost: z.string().trim().max(253).regex(/^[A-Za-z0-9.-]*$/, "Alamat printer hanya boleh berisi huruf, angka, titik, dan tanda minus.").optional(),
    printerPort: z.number().int().min(1).max(65535).optional(),
    printerSystemName: z.string().trim().max(100).regex(/^[A-Za-z0-9._-]*$/, "Nama printer hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda minus.").optional(),
    printerSerialPath: z.string().trim().max(255).regex(/^(COM[0-9]{1,3}|\/dev\/[A-Za-z0-9._-]+)?$/, "Port serial harus berbentuk COM3 (Windows) atau /dev/cu.NAMA (macOS/Linux).").optional(),
    printerBaudRate: z.number().refine((value) => (PRINTER_BAUD_RATES as readonly number[]).includes(value), "Baud rate tidak didukung.").optional(),
    drawerAutoOpen: z.boolean().optional(),
    tablePickerMode: z.enum(["map", "cards"]).optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    { message: "Tidak ada pengaturan yang diubah." },
  );

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const adminPasswordResetSchema = z.object({
  newPassword: z.string().min(8).max(128),
});
