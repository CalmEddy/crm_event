import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type AppDb =
  | ReturnType<typeof drizzleNode<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const migrateUrl =
  process.env.DATABASE_URL_UNPOOLED?.trim() || databaseUrl;

declare global {
  // eslint-disable-next-line no-var
  var __crmDbPromise: Promise<AppDb> | undefined;
  // eslint-disable-next-line no-var
  var __crmPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __crmPglite: PGlite | undefined;
}

/** Split migration SQL into single statements (poolers often reject multi-statement queries). */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((part) => part.length > 0);
}

async function applySqlMigrations(options: {
  exec: (sql: string) => Promise<unknown>;
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
}) {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await options.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const done = new Set(
    (await options.query("select name from schema_migrations")).rows.map(
      (row) => String(row.name),
    ),
  );

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    for (const statement of splitSqlStatements(sql)) {
      await options.exec(statement);
    }
    await options.query("insert into schema_migrations (name) values ($1)", [
      file,
    ]);
  }
}

async function createPostgresDb(): Promise<AppDb> {
  // Prefer a direct (unpooled) URL for DDL when the platform provides one.
  const migrationPool = new Pool({
    connectionString: migrateUrl,
    max: 1,
  });
  try {
    await applySqlMigrations({
      exec: async (sql) => {
        await migrationPool.query(sql);
      },
      query: (sql, params) => migrationPool.query(sql, params),
    });
  } finally {
    await migrationPool.end();
  }

  globalThis.__crmPool ??= new Pool({
    connectionString: databaseUrl,
    max: 5,
  });
  return drizzleNode(globalThis.__crmPool, { schema });
}

async function createPgliteDb(): Promise<AppDb> {
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });
  globalThis.__crmPglite ??= new PGlite(dataDir);
  const client = globalThis.__crmPglite;
  await applySqlMigrations({
    exec: async (sql) => {
      await client.exec(sql);
    },
    query: async (sql, params = []) => {
      const result = await client.query(sql, params);
      return { rows: (result.rows ?? []) as Record<string, unknown>[] };
    },
  });
  return drizzlePglite(client, { schema });
}

export type GetDbOptions = {
  /**
   * Skip Cursor viewer check. Use only for trusted system paths
   * (inbound webhook, cron, seed, notify after auth already verified).
   */
  system?: boolean;
};

export async function getDb(options?: GetDbOptions): Promise<AppDb> {
  if (!options?.system) {
    const { requireSignedIn } = await import("@/lib/auth");
    await requireSignedIn();
  }
  if (!globalThis.__crmDbPromise) {
    globalThis.__crmDbPromise = (
      databaseUrl !== "" ? createPostgresDb() : createPgliteDb()
    ).catch((error) => {
      globalThis.__crmDbPromise = undefined;
      throw error;
    });
  }
  return globalThis.__crmDbPromise;
}

export * from "./schema";
