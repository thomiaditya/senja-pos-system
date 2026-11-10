import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { seedDatabase } from "../src/lib/db/demo-seed.mjs";

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

const { createdDemoUsers } = seedDatabase(db, { withDemo, demoPassword });
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
