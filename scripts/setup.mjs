import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(root, "data");
const envPath = path.join(root, ".env.local");
const databasePath = path.join(dataDirectory, "pos.sqlite");
const withDemo = process.argv.includes("--demo");

await mkdir(dataDirectory, { recursive: true });

let envText = "";
try {
  envText = await readFile(envPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const existingEnv = new Map(
  envText
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
);

const generatedEnv = {};
if (!process.env.SESSION_SECRET && !existingEnv.has("SESSION_SECRET")) {
  generatedEnv.SESSION_SECRET = randomBytes(48).toString("base64url");
}
if (!process.env.DEMO_PASSWORD && !existingEnv.has("DEMO_PASSWORD")) {
  generatedEnv.DEMO_PASSWORD = randomBytes(12).toString("base64url");
}

if (Object.keys(generatedEnv).length > 0) {
  const additions = Object.entries(generatedEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  envText = `${envText.trimEnd()}${envText.trim() ? "\n" : ""}${additions}\n`;
  await writeFile(envPath, envText, { mode: 0o600 });
}

const sessionSecret = process.env.SESSION_SECRET ?? existingEnv.get("SESSION_SECRET") ?? generatedEnv.SESSION_SECRET;
const demoPassword = process.env.DEMO_PASSWORD ?? existingEnv.get("DEMO_PASSWORD") ?? generatedEnv.DEMO_PASSWORD;
if (!sessionSecret || !demoPassword) {
  throw new Error("SESSION_SECRET dan DEMO_PASSWORD wajib tersedia untuk setup lokal.");
}

const db = new Database(process.env.POS_DB_PATH ?? databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`);

const migrationDirectory = path.join(root, "src/lib/db/migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const appliedMigration = db.prepare("SELECT 1 FROM schema_migrations WHERE filename = ?");
const recordMigration = db.prepare("INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)");

for (const filename of migrationFiles) {
  if (appliedMigration.get(filename)) continue;
  const sql = await readFile(path.join(migrationDirectory, filename), "utf8");
  db.transaction(() => {
    db.exec(sql);
    recordMigration.run(filename, new Date().toISOString());
  })();
  console.log(`Applied migration ${filename}`);
}

const now = new Date();
const timestamp = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
const businessDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(now);

let createdDemoUsers = false;
const seed = db.transaction(() => {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount === 0) {
    createdDemoUsers = true;
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const passwordHash = bcrypt.hashSync(demoPassword, 11);
    for (const [id, name, username, role] of [
      ["demo-admin", "Dinda Pramesti", "admin", "admin"],
      ["demo-cashier", "Raka Putra", "kasir", "cashier"],
      ["demo-barista", "Maya Putri", "barista", "barista"],
      ["demo-kitchen", "Bima Santoso", "kitchen", "kitchen"],
    ]) {
      insertUser.run(id, name, username, passwordHash, role, timestamp());
    }
  }

  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of [
    ["outlet_name", "Toko Saya"],
    ["tax_rate_basis_points", "1000"],
    ["receipt_width_mm", "80"],
    ["receipt_footer", "Terima kasih telah berkunjung!"],
    ["setup_completed", "0"],
  ]) {
    insertSetting.run(key, value);
  }

  if (!withDemo) return;
  if (db.prepare("SELECT COUNT(*) AS count FROM products").get().count > 0) return;

  const ingredients = [
    ["coffee", "Coffee beans", "g", 1872, 350],
    ["milk", "Fresh milk", "ml", 6890, 1200],
    ["sugar", "Sugar", "g", 720, 200],
    ["matcha", "Matcha powder", "g", 64, 80],
    ["croissant", "Croissant", "pcs", 14, 4],
    ["chicken", "Chicken filling", "g", 1280, 400],
    ["bread", "Bread slices", "pcs", 26, 8],
    ["banana", "Banana", "pcs", 18, 4],
    ["butter", "Butter", "g", 800, 200],
    ["chocolate", "Chocolate powder", "g", 12, 50],
  ];
  const insertIngredient = db.prepare(`
    INSERT INTO ingredients (id, name, unit, on_hand, minimum, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const ingredient of ingredients) insertIngredient.run(...ingredient, timestamp());

  const products = [
    { id: 1, name: "Kopi Susu Senja", category: "Kopi", price: 26000, icon: "☕", note: "Favorit", modifiers: ["Regular", "Less sugar", "Extra shot"], station: "Barista" },
    { id: 2, name: "Cafe Latte", category: "Kopi", price: 30000, icon: "🥛", note: "", modifiers: ["Regular", "Less sugar", "Oat milk"], station: "Barista" },
    { id: 3, name: "Americano", category: "Kopi", price: 22000, icon: "🫘", note: "", modifiers: ["Regular", "Extra shot"], station: "Barista" },
    { id: 4, name: "Matcha Latte", category: "Non-kopi", price: 33000, icon: "🍵", note: "", modifiers: ["Regular", "Less sugar", "Oat milk"], station: "Barista" },
    { id: 5, name: "Croissant Butter", category: "Makanan", price: 24000, icon: "🥐", note: "", modifiers: ["Original", "Extra butter"], station: "Kitchen" },
    { id: 6, name: "Chicken Sandwich", category: "Makanan", price: 38000, icon: "🥪", note: "", modifiers: ["Original", "No mayo"], station: "Kitchen" },
    { id: 7, name: "Cokelat Hangat", category: "Non-kopi", price: 28000, icon: "🍫", note: "", modifiers: ["Regular", "Less sugar"], station: "Barista" },
    { id: 8, name: "Pisang Roti Bakar", category: "Makanan", price: 27000, icon: "🍞", note: "Baru", modifiers: ["Original", "Extra butter"], station: "Kitchen" },
    { id: 9, name: "Cappuccino", category: "Kopi", price: 28000, icon: "☕", note: "", modifiers: ["Regular", "Extra shot"], station: "Barista" },
  ];
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, price, icon, note, modifiers_json, station, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  products.forEach((product, index) => {
    insertProduct.run(
      product.id, product.name, product.category, product.price, product.icon, product.note,
      JSON.stringify(product.modifiers), product.station, index + 1, timestamp(),
    );
  });

  const recipes = [
    [1, "coffee", 18], [1, "milk", 120], [1, "sugar", 10],
    [2, "coffee", 18], [2, "milk", 150],
    [3, "coffee", 18],
    [4, "matcha", 8], [4, "milk", 150], [4, "sugar", 5],
    [5, "croissant", 1],
    [6, "chicken", 80], [6, "bread", 2],
    [7, "chocolate", 20], [7, "milk", 150],
    [8, "bread", 2], [8, "banana", 1], [8, "butter", 10],
    [9, "coffee", 18], [9, "milk", 100],
  ];
  const insertRecipe = db.prepare(`
    INSERT INTO product_recipes (product_id, ingredient_id, amount_per_item) VALUES (?, ?, ?)
  `);
  for (const recipe of recipes) insertRecipe.run(...recipe);

  const insertTable = db.prepare(`
    INSERT INTO dining_tables (name, x, y, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
  `);
  Array.from({ length: 10 }, (_, index) => ({
    name: `Meja ${String(index + 1).padStart(2, "0")}`,
    x: 12 + (index % 4) * 25,
    y: 15 + Math.floor(index / 4) * 25,
  })).forEach((table) => insertTable.run(table.name, table.x, table.y, timestamp(), timestamp()));

  const insertShape = db.prepare(`
    INSERT INTO map_shapes (kind, label, x, y, width, height, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    { kind: "rectangle", label: "Area indoor", x: 4, y: 4, width: 92, height: 70 },
    { kind: "rectangle", label: "Area outdoor", x: 4, y: 80, width: 92, height: 16 },
    { kind: "wall", label: null, x: 4, y: 77, width: 92, height: 2 },
    { kind: "counter", label: "Bar", x: 60, y: 58, width: 32, height: 6 },
  ].forEach((shape) => insertShape.run(
    shape.kind, shape.label, shape.x, shape.y, shape.width, shape.height, timestamp(), timestamp(),
  ));

  const demoAdmin = "demo-admin";
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (id, ingredient_id, type, amount, reason, actor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertMovement.run(randomUUID(), "coffee", "Stock In", 1000, "Penerimaan stok pagi", demoAdmin, timestamp(95));
  insertMovement.run(randomUUID(), "matcha", "Stock Adjustment", -8, "Stock opname sebelum buka", demoAdmin, timestamp(70));

  const itemRows = new Map(products.map((product) => [product.id, product]));
  const recipeRows = db.prepare(`
    SELECT ingredient_id, amount_per_item FROM product_recipes WHERE product_id = ?
  `);
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, order_number, idempotency_key, created_at, order_type, table_number, status,
      subtotal, tax, total, note, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, order_id, method, status, amount, reference, created_at)
    VALUES (?, ?, ?, 'Paid', ?, ?, ?)
  `);
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (
      id, order_id, product_id, product_name, quantity, unit_price, modifier, station
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTicket = db.prepare(`
    INSERT INTO station_tickets (id, order_id, station, status, started_at, ready_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertTicketItem = db.prepare(`
    INSERT INTO ticket_items (ticket_id, order_item_id, quantity) VALUES (?, ?, ?)
  `);
  const insertReservation = db.prepare(`
    INSERT INTO ticket_reservations (id, ticket_id, ingredient_id, amount, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertOrderMovement = db.prepare(`
    INSERT INTO inventory_movements (
      id, ingredient_id, type, amount, reason, actor_id, order_id, ticket_id, created_at
    ) VALUES (?, ?, 'Stock Out', ?, ?, ?, ?, ?, ?)
  `);
  const insertReservationMovement = db.prepare(`
    INSERT INTO inventory_movements (
      id, ingredient_id, type, amount, reason, actor_id, order_id, ticket_id, created_at
    ) VALUES (?, ?, 'Stock Reserved', ?, ?, ?, ?, ?, ?)
  `);

  const orders = [
    {
      sequence: 28, minutesAgo: 48, type: "Dine-in", table: "Meja 05", method: "Cash", status: "Completed",
      note: "", items: [[1, 2, "Less sugar"], [5, 1, "Original"]],
    },
    {
      sequence: 27, minutesAgo: 24, type: "Takeaway", table: null, method: "QRIS", status: "Preparing",
      note: "Saus dipisah", items: [[2, 1, "Oat milk"], [6, 1, "No mayo"]],
    },
    {
      sequence: 26, minutesAgo: 8, type: "Dine-in", table: "Meja 03", method: "Debit/Kredit", status: "Queued",
      note: "", items: [[3, 1, "Regular"]],
    },
    {
      sequence: 25, minutesAgo: 67, type: "Takeaway", table: null, method: "QRIS", status: "Completed",
      note: "", items: [[3, 1, "Regular"], [5, 1, "Original"]],
    },
  ];
  const stockOutAtStart = db.prepare(`
    UPDATE ingredients SET on_hand = on_hand - ?, updated_at = ?
    WHERE id = ? AND on_hand >= ?
  `);
  const reserveAtPayment = db.prepare(`
    UPDATE ingredients SET reserved = reserved + ?, updated_at = ?
    WHERE id = ? AND on_hand - reserved >= ?
  `);

  for (const orderData of orders) {
    const orderId = `demo-order-${orderData.sequence}`;
    const createdAt = timestamp(orderData.minutesAgo);
    const orderNumber = `POS-${businessDate.replaceAll("-", "")}-${String(orderData.sequence).padStart(3, "0")}`;
    const normalizedItems = orderData.items.map(([productId, quantity, modifier]) => {
      const product = itemRows.get(productId);
      return {
        id: randomUUID(),
        productId,
        productName: product.name,
        category: product.category,
        quantity,
        unitPrice: product.price,
        modifier,
        station: product.station,
      };
    });
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const tax = Math.round(subtotal * 0.1);
    insertOrder.run(
      orderId, orderNumber, `seed-${orderId}`, createdAt, orderData.type, orderData.table, orderData.status,
      subtotal, tax, subtotal + tax, orderData.note, demoAdmin,
    );
    insertPayment.run(randomUUID(), orderId, orderData.method, subtotal + tax, `DEMO-${orderData.sequence}`, createdAt);

    for (const item of normalizedItems) {
      insertOrderItem.run(
        item.id, orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.modifier, item.station,
      );
    }

    const byStation = new Map();
    for (const item of normalizedItems) {
      byStation.set(item.station, [...(byStation.get(item.station) ?? []), item]);
    }
    for (const [station, ticketItems] of byStation) {
      const ticketId = randomUUID();
      const ticketStatus = orderData.status === "Completed" ? "Ready" : orderData.status;
      const startedAt = ticketStatus === "Queued" ? null : timestamp(orderData.minutesAgo - 2);
      const readyAt = ticketStatus === "Ready" ? timestamp(orderData.minutesAgo - 1) : null;
      insertTicket.run(ticketId, orderId, station, ticketStatus, startedAt, readyAt);
      for (const item of ticketItems) insertTicketItem.run(ticketId, item.id, item.quantity);

      const requirements = new Map();
      for (const item of ticketItems) {
        for (const recipe of recipeRows.all(item.productId)) {
          requirements.set(
            recipe.ingredient_id,
            (requirements.get(recipe.ingredient_id) ?? 0) + recipe.amount_per_item * item.quantity,
          );
        }
      }
      for (const [ingredientId, amount] of requirements) {
        if (ticketStatus === "Queued") {
          const result = reserveAtPayment.run(amount, createdAt, ingredientId, amount);
          if (result.changes !== 1) throw new Error(`Not enough demo stock for ${ingredientId}.`);
          insertReservation.run(randomUUID(), ticketId, ingredientId, amount, "Reserved", createdAt);
          insertReservationMovement.run(
            randomUUID(), ingredientId, amount, `Reservasi tiket ${station}`,
            demoAdmin, orderId, ticketId, createdAt,
          );
        } else {
          const result = stockOutAtStart.run(amount, createdAt, ingredientId, amount);
          if (result.changes !== 1) throw new Error(`Not enough demo stock for ${ingredientId}.`);
          insertReservation.run(randomUUID(), ticketId, ingredientId, amount, "Consumed", createdAt);
          insertOrderMovement.run(
            randomUUID(), ingredientId, -amount, `Produksi tiket ${station}`,
            demoAdmin, orderId, ticketId, startedAt,
          );
        }
      }
    }
  }
  db.prepare("INSERT OR REPLACE INTO order_sequences (business_date, next_value) VALUES (?, 29)")
    .run(businessDate);
});

seed();
if (withDemo) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('setup_completed', '1')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run();
}
db.close();

console.log("POS database is ready.");
console.log(
  withDemo
    ? "Demo data was loaded (--demo). Setup wizard is skipped."
    : "Empty setup: admin will be guided through the setup wizard on first login.",
);
console.log("Login usernames: admin, kasir, barista, kitchen");
if (createdDemoUsers) {
  console.log(`Demo password (same for all demo users): ${demoPassword}`);
} else {
  console.log("Existing demo users were preserved; their passwords were not changed.");
}
