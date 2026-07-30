import "dotenv/config";

import { createHash } from "node:crypto";

import pg from "pg";

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error("DATABASE_URL is required.");
  }

  const url = new URL(value);
  const sslMode = url.searchParams.get("sslmode");

  if (!sslMode || ["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }

  url.searchParams.delete("channel_binding");
  return url.toString();
}

async function main() {
  const pool = new pg.Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: 15_000,
    max: 1,
  });

  try {
    const [
      columns,
      compatibilityPreflight,
      migrations,
      relatedTables,
      lineage,
      authenticationColumns,
      dashboardColumns,
      enumValues,
      stockLineage,
    ] = await Promise.all([
      pool.query<{
        column_name: string;
        data_type: string;
        numeric_precision: number | null;
        numeric_scale: number | null;
        column_default: string | null;
        is_nullable: "YES" | "NO";
      }>(`
        SELECT
          column_name,
          data_type,
          numeric_precision,
          numeric_scale,
          column_default,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sale_items'
        ORDER BY ordinal_position
      `),
      pool.query<{
        invalid_sales_branches: string;
        invalid_purchase_branches: string;
        invalid_expense_branches: string;
        invalid_customer_payment_branches: string;
        invalid_supplier_payment_branches: string;
        invalid_stock_movement_branches: string;
        invalid_transfer_source_branches: string;
        invalid_transfer_destination_branches: string;
        invalid_alert_branches: string;
      }>(`
        SELECT
          (SELECT COUNT(*) FROM sales row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."locationId"
            ))::text AS invalid_sales_branches,
          (SELECT COUNT(*) FROM purchases row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."locationId"
            ))::text AS invalid_purchase_branches,
          (SELECT COUNT(*) FROM expenses row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."locationId"
            ))::text AS invalid_expense_branches,
          (SELECT COUNT(*) FROM customer_payments row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."locationId"
            ))::text AS invalid_customer_payment_branches,
          (SELECT COUNT(*) FROM supplier_payments row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."locationId"
            ))::text AS invalid_supplier_payment_branches,
          (SELECT COUNT(*) FROM stock_movements row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."locationId"
            ))::text AS invalid_stock_movement_branches,
          (SELECT COUNT(*) FROM transfers row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."sourceLocationId"
            ))::text AS invalid_transfer_source_branches,
          (SELECT COUNT(*) FROM transfers row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."destinationLocationId"
            ))::text AS invalid_transfer_destination_branches,
          (SELECT COUNT(*) FROM alert_records row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."locationId"
            ))::text AS invalid_alert_branches
      `),
      pool.query<{
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
        logs: string | null;
      }>(`
        SELECT migration_name, checksum, finished_at, rolled_back_at, logs
        FROM _prisma_migrations
        ORDER BY started_at
      `),
      pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND (
            table_name ILIKE '%return%'
            OR table_name ILIKE '%price%'
          )
        ORDER BY table_name
      `),
      pool.query<{
        branch_count: string;
        sales_count: string;
        sales_location_count: string;
        sales_locations_matching_branches: string;
        purchase_count: string;
        purchase_location_count: string;
        purchase_locations_matching_branches: string;
        price_history_count: string;
        product_location_price_count: string;
        sales_return_count: string;
        user_default_location_count: string;
        user_defaults_matching_branches: string;
        session_active_location_count: string;
        session_locations_matching_branches: string;
        seller_table_exists: boolean;
        inventory_adjustment_table_exists: boolean;
        user_branch_count: string;
        user_branch_locations_matching_branches: string;
      }>(`
        SELECT
          (SELECT COUNT(*) FROM branches)::text AS branch_count,
          (SELECT COUNT(*) FROM sales)::text AS sales_count,
          (
            SELECT COUNT(DISTINCT "locationId")
            FROM sales
            WHERE "locationId" IS NOT NULL
          )::text AS sales_location_count,
          (
            SELECT COUNT(DISTINCT sale."locationId")
            FROM sales sale
            WHERE EXISTS (
              SELECT 1
              FROM branches branch
              WHERE branch.id = sale."locationId"
            )
          )::text AS sales_locations_matching_branches,
          (SELECT COUNT(*) FROM purchases)::text AS purchase_count,
          (
            SELECT COUNT(DISTINCT "locationId")
            FROM purchases
            WHERE "locationId" IS NOT NULL
          )::text AS purchase_location_count,
          (
            SELECT COUNT(DISTINCT purchase."locationId")
            FROM purchases purchase
            WHERE EXISTS (
              SELECT 1
              FROM branches branch
              WHERE branch.id = purchase."locationId"
            )
          )::text AS purchase_locations_matching_branches,
          (SELECT COUNT(*) FROM price_adjustment_history)::text
            AS price_history_count,
          (SELECT COUNT(*) FROM product_location_prices)::text
            AS product_location_price_count,
          (SELECT COUNT(*) FROM sales_returns)::text AS sales_return_count,
          (
            SELECT COUNT(*)
            FROM users
            WHERE "defaultLocationId" IS NOT NULL
          )::text AS user_default_location_count,
          (
            SELECT COUNT(*)
            FROM users app_user
            WHERE "defaultLocationId" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM branches branch
                WHERE branch.id = app_user."defaultLocationId"
              )
          )::text AS user_defaults_matching_branches,
          (
            SELECT COUNT(*)
            FROM sessions
            WHERE "activeLocationId" IS NOT NULL
          )::text AS session_active_location_count,
          (
            SELECT COUNT(*)
            FROM sessions session_row
            WHERE "activeLocationId" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM branches branch
                WHERE branch.id = session_row."activeLocationId"
              )
          )::text AS session_locations_matching_branches,
          to_regclass('public.sellers') IS NOT NULL AS seller_table_exists,
          to_regclass('public.inventory_adjustments') IS NOT NULL
            AS inventory_adjustment_table_exists,
          (SELECT COUNT(*) FROM user_branches)::text AS user_branch_count,
          (
            SELECT COUNT(*)
            FROM user_branches assignment
            WHERE EXISTS (
              SELECT 1
              FROM branches branch
              WHERE branch.id = assignment."locationId"
            )
          )::text AS user_branch_locations_matching_branches
      `),
      pool.query<{ table_name: string; column_name: string }>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (
            'users',
            'sessions',
            'auth_accounts',
            'user_branches'
          )
        ORDER BY table_name, ordinal_position
      `),
      pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: "YES" | "NO";
        column_default: string | null;
      }>(`
        SELECT
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (
            'alert_records',
            'audit_logs',
            'customer_payments',
            'expenses',
            'finance_accounts',
            'ledger_entries',
            'products',
            'purchase_items',
            'purchases',
            'sale_item_allocations',
            'sales',
            'seller_collections',
            'seller_settlements',
            'stock_movements',
            'supplier_payments',
            'transfer_items',
            'transfers'
          )
        ORDER BY table_name, ordinal_position
      `),
      pool.query<{ enum_name: string; enum_value: string }>(`
        SELECT
          type.typname AS enum_name,
          enum.enumlabel AS enum_value
        FROM pg_type type
        JOIN pg_enum enum ON enum.enumtypid = type.oid
        JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
        WHERE namespace.nspname = 'public'
          AND type.typname IN (
            'AppRole',
            'LedgerEntryType',
            'SalePaymentMethod',
            'SaleStatus',
            'SettlementStatus',
            'StockMovementType',
            'StockOwnershipType'
          )
        ORDER BY type.typname, enum.enumsortorder
      `),
      pool.query<{
        purchase_item_count: string;
        transfer_item_count: string;
        sale_item_count: string;
        stock_movement_count: string;
        purchase_quantity: string;
        transfer_in_quantity: string;
        sale_quantity: string;
        adjustment_quantity: string;
        sale_movements_matching_lines: string;
      }>(`
        SELECT
          (SELECT COUNT(*) FROM purchase_items)::text AS purchase_item_count,
          (SELECT COUNT(*) FROM transfer_items)::text AS transfer_item_count,
          (SELECT COUNT(*) FROM sale_items)::text AS sale_item_count,
          (SELECT COUNT(*) FROM stock_movements)::text AS stock_movement_count,
          COALESCE((
            SELECT SUM(quantity) FROM stock_movements
            WHERE "movementType" = 'PURCHASE'
          ), 0)::text AS purchase_quantity,
          COALESCE((
            SELECT SUM(quantity) FROM stock_movements
            WHERE "movementType" = 'TRANSFER_IN'
          ), 0)::text AS transfer_in_quantity,
          COALESCE((
            SELECT SUM(quantity) FROM stock_movements
            WHERE "movementType" = 'SALE'
          ), 0)::text AS sale_quantity,
          COALESCE((
            SELECT SUM(quantity) FROM stock_movements
            WHERE "movementType" = 'ADJUSTMENT'
          ), 0)::text AS adjustment_quantity,
          (
            SELECT COUNT(*)
            FROM stock_movements movement
            JOIN sale_items item ON item.id = movement."sourceLineId"
            WHERE movement."movementType" = 'SALE'
          )::text AS sale_movements_matching_lines
      `),
    ]);

    const fixedDiscount = columns.rows.find(
      (column) => column.column_name === "fixedDiscount",
    );
    const authColumnsByTable = authenticationColumns.rows.reduce<
      Record<string, Array<{ table_name: string; column_name: string }>>
    >((groups, column) => {
      (groups[column.table_name] ??= []).push(column);
      return groups;
    }, {});
    const expectedAuthColumns = {
      users: [
        "id",
        "name",
        "email",
        "phone",
        "emailVerified",
        "image",
        "username",
        "displayUsername",
        "displayName",
        "role",
        "isActive",
        "defaultBranchId",
        "createdAt",
        "updatedAt",
      ],
      sessions: [
        "id",
        "expiresAt",
        "token",
        "ipAddress",
        "userAgent",
        "activeBranchId",
        "userId",
        "createdAt",
        "updatedAt",
      ],
      auth_accounts: [
        "id",
        "accountId",
        "providerId",
        "userId",
        "accessToken",
        "refreshToken",
        "idToken",
        "accessTokenExpiresAt",
        "refreshTokenExpiresAt",
        "scope",
        "password",
        "createdAt",
        "updatedAt",
      ],
      user_branches: [
        "id",
        "userId",
        "branchId",
        "isDefault",
        "isActive",
        "createdAt",
      ],
    } as const;
    const missingAuthenticationColumns = Object.fromEntries(
      Object.entries(expectedAuthColumns).map(([table, expected]) => {
        const actual = new Set(
          (authColumnsByTable[table] ?? []).map((column) => column.column_name),
        );

        return [table, expected.filter((column) => !actual.has(column))];
      }),
    );

    console.log(
      JSON.stringify(
        {
          fixedDiscount: fixedDiscount ?? null,
          saleItemColumnCount: columns.rowCount,
          migrationHistory: migrations.rows.map((migration) => ({
            name: migration.migration_name,
            checksumPrefix: migration.checksum.slice(0, 12),
            finished: Boolean(migration.finished_at),
            rolledBack: Boolean(migration.rolled_back_at),
            hasLogs: Boolean(migration.logs),
          })),
          relatedTables: relatedTables.rows.map((row) => row.table_name),
          lineage: lineage.rows[0],
          missingAuthenticationColumns,
          dashboardColumns: dashboardColumns.rows,
          enumValues: enumValues.rows,
          stockLineage: stockLineage.rows[0],
          compatibilityPreflight: compatibilityPreflight.rows[0],
          schemaFingerprint: createHash("sha256")
            .update(JSON.stringify(columns.rows))
            .digest("hex")
            .slice(0, 16),
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
