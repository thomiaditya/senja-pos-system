import type { Order, ReceiptDesign, ReceiptFontSize, StationTicket } from "@/lib/types";

export type PrinterWidth = 58 | 80;

const ESC = 0x1b;
const GS = 0x1d;

const INIT = [ESC, 0x40];
const ALIGN_LEFT = [ESC, 0x61, 0];
const ALIGN_CENTER = [ESC, 0x61, 1];
const BOLD_ON = [ESC, 0x45, 1];
const BOLD_OFF = [ESC, 0x45, 0];
const SIZE_NORMAL = [GS, 0x21, 0x00];
const SIZE_TALL = [GS, 0x21, 0x01];
const SIZE_WIDE = [GS, 0x21, 0x10];
const SIZE_LARGE = [GS, 0x21, 0x11];
// Font B (9x17) lebih kecil dari font A default, sehingga muat lebih banyak karakter.
const FONT_B = [ESC, 0x4d, 0x01];
const FEED_LINES = [ESC, 0x64, 4];
// Feed lalu potong kertas. Setiap dokumen diakhiri perintah ini.
const CUT_PAPER = [GS, 0x56, 0x42, 0x03];

export function columnsFor(width: PrinterWidth, fontSize: ReceiptFontSize = "normal") {
  if (fontSize === "kecil") return width === 58 ? 42 : 64;
  const columns = width === 58 ? 32 : 48;
  // Font double-width memakai dua kolom per karakter.
  return fontSize === "besar" ? columns / 2 : columns;
}

// Printer thermal umumnya hanya andal untuk ASCII, jadi karakter lain didowngrade.
export function toPrinterText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/×/g, "x")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .trim();
}

export function formatRupiah(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(value))}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function wrap(text: string, columns: number): string[] {
  const clean = toPrinterText(text);
  if (!clean) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    let rest = word;
    while (rest.length > columns) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(rest.slice(0, columns));
      rest = rest.slice(columns);
    }
    const candidate = current ? `${current} ${rest}` : rest;
    if (candidate.length <= columns) {
      current = candidate;
    } else {
      lines.push(current);
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Kolom kiri dipotong jika tidak muat, kolom kanan (nominal) selalu utuh.
function row(left: string, right: string, columns: number) {
  const l = toPrinterText(left);
  const r = toPrinterText(right);
  const gap = columns - l.length - r.length;
  if (gap >= 1) return `${l}${" ".repeat(gap)}${r}`;
  return `${l.slice(0, Math.max(0, columns - r.length - 1))} ${r}`;
}

class PrintDocument {
  private readonly parts: Buffer[] = [];
  readonly columns: number;
  private readonly baseSize: number[];

  constructor(width: PrinterWidth, fontSize: ReceiptFontSize = "normal") {
    this.columns = columnsFor(width, fontSize);
    this.baseSize = fontSize === "besar" ? SIZE_WIDE : SIZE_NORMAL;
    this.parts.push(Buffer.from(INIT));
    if (fontSize === "kecil") this.command(FONT_B);
    if (fontSize === "besar") this.command(SIZE_WIDE);
  }

  private command(bytes: number[]) {
    this.parts.push(Buffer.from(bytes));
    return this;
  }

  private text(value: string) {
    this.parts.push(Buffer.from(`${value}\n`, "ascii"));
    return this;
  }

  wrapped(value: string) {
    for (const line of wrap(value, this.columns)) this.text(line);
    return this;
  }

  centered(value: string, options: { bold?: boolean; size?: number[] } = {}) {
    this.command(ALIGN_CENTER);
    if (options.bold) this.command(BOLD_ON);
    if (options.size) this.command(options.size);
    this.wrapped(value);
    return this.command(this.baseSize).command(BOLD_OFF).command(ALIGN_LEFT);
  }

  rule() {
    return this.text("-".repeat(this.columns));
  }

  pair(left: string, right: string, options: { bold?: boolean } = {}) {
    if (options.bold) this.command(BOLD_ON);
    this.text(row(left, right, this.columns));
    if (options.bold) this.command(BOLD_OFF);
    return this;
  }

  bold(value: string, size: number[] = SIZE_NORMAL) {
    this.command(BOLD_ON).command(size);
    this.wrapped(value);
    return this.command(this.baseSize).command(BOLD_OFF);
  }

  finish() {
    this.command(FEED_LINES).command(CUT_PAPER);
    return Buffer.concat(this.parts);
  }
}

function orderTypeLabel(order: Order) {
  return `${order.type}${order.table ? ` - ${order.table}` : ""}`;
}

export function buildReceiptJob(input: {
  width: PrinterWidth;
  outletName: string;
  footer: string;
  design: ReceiptDesign;
  order: Order;
}) {
  const { order, design } = input;
  const doc = new PrintDocument(input.width, design.fontSize);

  doc.centered(input.outletName, { bold: true, size: SIZE_TALL });
  if (design.headerText) doc.centered(design.headerText);
  doc.centered("Bukti pembayaran");
  doc.rule();
  doc.pair("No. pesanan", order.orderNumber);
  doc.pair("Waktu", formatDateTime(order.createdAt));
  doc.pair("Jenis", orderTypeLabel(order));
  if (order.customerName && design.showCustomer) doc.wrapped(`Pelanggan: ${order.customerName}`);
  doc.rule();
  for (const item of order.items) {
    doc.pair(`${item.quantity}x ${item.name}`, formatRupiah(item.unitPrice * item.quantity));
    if (item.modifier) doc.wrapped(`  ${item.modifier}`);
  }
  if (order.note && design.showNote) doc.wrapped(`Catatan: ${order.note}`);
  doc.rule();
  doc.pair("Subtotal", formatRupiah(order.subtotal ?? 0));
  if (design.showDiscount && (order.discountAmount ?? 0) > 0) {
    doc.wrapped(`Diskon: ${order.discountName ?? "-"}`);
    doc.pair("Potongan", `-${formatRupiah(order.discountAmount ?? 0)}`);
  }
  if (design.showTax) doc.pair("Pajak", formatRupiah(order.tax ?? 0));
  doc.pair("TOTAL", formatRupiah(order.total ?? 0), { bold: true });
  doc.pair("Pembayaran", order.paymentMethod ?? "-");
  if (design.showCashChange && order.cashReceived !== null) {
    doc.pair("Tunai", formatRupiah(order.cashReceived));
    doc.pair("Kembalian", formatRupiah(order.changeAmount ?? 0));
  }
  doc.rule();
  doc.centered(input.footer);
  if (design.showPaymentRef) doc.centered(`Ref. ${order.paymentReference ?? "-"}`);
  return doc.finish();
}

export function buildTicketJob(input: {
  width: PrinterWidth;
  outletName: string;
  order: Order;
  ticket: StationTicket;
}) {
  const { order, ticket } = input;
  const doc = new PrintDocument(input.width);

  doc.centered(`TIKET ${ticket.station === "Kitchen" ? "KITCHEN" : "BARISTA"}`, { bold: true, size: SIZE_LARGE });
  doc.centered(input.outletName);
  doc.rule();
  doc.pair("Pesanan", order.orderNumber);
  doc.pair("Waktu", formatDateTime(order.createdAt));
  doc.pair("Jenis", orderTypeLabel(order));
  if (order.customerName) doc.bold(`Pelanggan: ${order.customerName}`);
  doc.rule();
  for (const item of ticket.items) {
    doc.bold(`${item.quantity}x ${item.name}`, SIZE_TALL);
    if (item.modifier) doc.wrapped(`   ${item.modifier}`);
  }
  if (order.note) doc.wrapped(`Catatan: ${order.note}`);
  doc.rule();
  doc.centered(`Tiket produksi - ${ticket.station}`);
  return doc.finish();
}

export function buildTestJob(input: { width: PrinterWidth; outletName: string }) {
  const doc = new PrintDocument(input.width);
  doc.centered("TES CETAK", { bold: true, size: SIZE_LARGE });
  doc.centered(input.outletName);
  doc.rule();
  doc.pair("Lebar kertas", `${input.width} mm`);
  doc.pair("Waktu", formatDateTime(new Date().toISOString()));
  doc.rule();
  doc.centered("Printer terhubung dengan server POS.");
  return doc.finish();
}

// ESC p m t1 t2: pulsa pin drawer kick (konektor RJ11) untuk membuka laci kasir.
const DRAWER_KICK = [ESC, 0x70, 0x00, 0x19, 0xfa];

export function buildDrawerKickJob() {
  return Buffer.from([...INIT, ...DRAWER_KICK]);
}
