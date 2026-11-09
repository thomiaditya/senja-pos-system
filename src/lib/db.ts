import "server-only";

import Database from "better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const databasePath = process.env.POS_DB_PATH ?? path.join(process.cwd(), "data/pos.sqlite");
export const dataDirectory = path.dirname(databasePath);
const migrationPath = path.join(process.cwd(), "src/lib/db/migrations");

type PosGlobal = typeof globalThis & {
  __kopiSenjaDatabase?: Database.Database;
};

function openDatabase() {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const connection = new Database(databasePath);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  connection.pragma("busy_timeout = 5000");
  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const hasMigration = connection.prepare("SELECT 1 FROM schema_migrations WHERE filename = ?");
  const addMigration = connection.prepare(
    "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
  );
  const migrationFiles = readdirSync(migrationPath)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of migrationFiles) {
    if (hasMigration.get(filename)) continue;
    const sql = readFileSync(path.join(migrationPath, filename), "utf8");
    connection.transaction(() => {
      if (hasMigration.get(filename)) return;
      connection.exec(sql);
      addMigration.run(filename, new Date().toISOString());
    }).immediate();
  }

  return connection;
}

const globalForDatabase = globalThis as PosGlobal;
export const db = globalForDatabase.__kopiSenjaDatabase ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.__kopiSenjaDatabase = db;
}
