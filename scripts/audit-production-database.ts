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
      transactionIntegrity,
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
              WHERE branch.id = row."branchId"
            ))::text AS invalid_sales_branches,
          (SELECT COUNT(*) FROM purchases row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."branchId"
            ))::text AS invalid_purchase_branches,
          (SELECT COUNT(*) FROM expenses row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."branchId"
            ))::text AS invalid_expense_branches,
          (SELECT COUNT(*) FROM customer_payments row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."branchId"
            ))::text AS invalid_customer_payment_branches,
          (SELECT COUNT(*) FROM supplier_payments row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."branchId"
            ))::text AS invalid_supplier_payment_branches,
          (SELECT COUNT(*) FROM stock_movements row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."branchId"
            ))::text AS invalid_stock_movement_branches,
          (SELECT COUNT(*) FROM transfers row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."sourceBranchId"
            ))::text AS invalid_transfer_source_branches,
          (SELECT COUNT(*) FROM transfers row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."destinationBranchId"
            ))::text AS invalid_transfer_destination_branches,
          (SELECT COUNT(*) FROM alert_records row
            WHERE NOT EXISTS (
              SELECT 1 FROM branches branch
              WHERE branch.id = row."branchId"
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
        price_history_table_exists: boolean;
        product_location_price_table_exists: boolean;
        sales_return_table_exists: boolean;
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
            SELECT COUNT(DISTINCT "branchId")
            FROM sales
            WHERE "branchId" IS NOT NULL
          )::text AS sales_location_count,
          (
            SELECT COUNT(DISTINCT sale."branchId")
            FROM sales sale
            WHERE EXISTS (
              SELECT 1
              FROM branches branch
              WHERE branch.id = sale."branchId"
            )
          )::text AS sales_locations_matching_branches,
          (SELECT COUNT(*) FROM purchases)::text AS purchase_count,
          (
            SELECT COUNT(DISTINCT "branchId")
            FROM purchases
            WHERE "branchId" IS NOT NULL
          )::text AS purchase_location_count,
          (
            SELECT COUNT(DISTINCT purchase."branchId")
            FROM purchases purchase
            WHERE EXISTS (
              SELECT 1
              FROM branches branch
              WHERE branch.id = purchase."branchId"
            )
          )::text AS purchase_locations_matching_branches,
          to_regclass('public.price_adjustment_history') IS NOT NULL
            AS price_history_table_exists,
          to_regclass('public.product_location_prices') IS NOT NULL
            AS product_location_price_table_exists,
          to_regclass('public.sales_returns') IS NOT NULL
            AS sales_return_table_exists,
          (
            SELECT COUNT(*)
            FROM users
            WHERE "defaultBranchId" IS NOT NULL
          )::text AS user_default_location_count,
          (
            SELECT COUNT(*)
            FROM users app_user
            WHERE "defaultBranchId" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM branches branch
                WHERE branch.id = app_user."defaultBranchId"
              )
          )::text AS user_defaults_matching_branches,
          (
            SELECT COUNT(*)
            FROM sessions
            WHERE "activeBranchId" IS NOT NULL
          )::text AS session_active_location_count,
          (
            SELECT COUNT(*)
            FROM sessions session_row
            WHERE "activeBranchId" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM branches branch
                WHERE branch.id = session_row."activeBranchId"
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
              WHERE branch.id = assignment."branchId"
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
      pool.query<{
        unbalanced_cash_transfers: string;
        paid_sales_without_ledger: string;
        paid_purchases_without_ledger: string;
        customer_payments_without_ledger: string;
        supplier_payments_without_ledger: string;
        expenses_without_ledger: string;
        seller_settlements_without_ledger: string;
        seller_collections_without_ledger: string;
        completed_sales_without_stock_movement: string;
        posted_purchases_without_stock_movement: string;
      }>(`
        SELECT
          (
            SELECT COUNT(*)
            FROM (
              SELECT "referenceId"
              FROM ledger_entries
              WHERE "entryType" = 'CASH_TRANSFER'
              GROUP BY "referenceId"
              HAVING
                SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END)
                <> SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END)
                OR COUNT(*) FILTER (WHERE direction = 'DEBIT') = 0
                OR COUNT(*) FILTER (WHERE direction = 'CREDIT') = 0
            ) transfer
          )::text AS unbalanced_cash_transfers,
          (
            SELECT COUNT(*)
            FROM sales sale
            WHERE sale.status = 'COMPLETED'
              AND sale."amountPaid" > 0
              AND sale."paymentMethod" <> 'CREDIT'
              AND NOT EXISTS (
                SELECT 1 FROM ledger_entries entry
                WHERE entry."referenceType" = 'Sale'
                  AND entry."referenceId" IN (sale.id, sale."saleNumber")
                  AND entry.direction = 'DEBIT'
              )
          )::text AS paid_sales_without_ledger,
          (
            SELECT COUNT(*)
            FROM purchases purchase
            WHERE purchase.status = 'POSTED'
              AND purchase."amountPaid" > 0
              AND NOT EXISTS (
                SELECT 1
                FROM ledger_entries entry
                LEFT JOIN supplier_payments payment
                  ON entry."referenceType" = 'SupplierPayment'
                  AND entry."referenceId" IN (
                    payment.id,
                    payment."paymentNumber"
                  )
                WHERE entry.direction = 'CREDIT'
                  AND (
                    (entry."referenceType" = 'Purchase'
                      AND entry."referenceId" IN (
                        purchase.id,
                        purchase."purchaseNumber"
                      ))
                    OR payment."purchaseId" = purchase.id
                  )
              )
          )::text AS paid_purchases_without_ledger,
          (
            SELECT COUNT(*) FROM customer_payments payment
            WHERE NOT EXISTS (
              SELECT 1 FROM ledger_entries entry
              WHERE entry."referenceType" = 'CustomerPayment'
                AND entry."referenceId" IN (
                  payment.id,
                  payment."paymentNumber"
                )
                AND entry.direction = 'DEBIT'
            )
          )::text AS customer_payments_without_ledger,
          (
            SELECT COUNT(*) FROM supplier_payments payment
            WHERE NOT EXISTS (
              SELECT 1 FROM ledger_entries entry
              WHERE entry."referenceType" = 'SupplierPayment'
                AND entry."referenceId" IN (
                  payment.id,
                  payment."paymentNumber"
                )
                AND entry.direction = 'CREDIT'
            )
          )::text AS supplier_payments_without_ledger,
          (
            SELECT COUNT(*) FROM expenses expense
            WHERE expense.status = 'POSTED'
              AND NOT EXISTS (
                SELECT 1 FROM ledger_entries entry
                WHERE entry."referenceType" = 'Expense'
                  AND entry."referenceId" IN (
                    expense.id,
                    expense."expenseNumber"
                  )
                  AND entry.direction = 'CREDIT'
              )
          )::text AS expenses_without_ledger,
          (
            SELECT COUNT(*) FROM seller_settlements settlement
            WHERE settlement.status = 'POSTED'
              AND NOT EXISTS (
                SELECT 1 FROM ledger_entries entry
                WHERE entry."referenceType" = 'SellerSettlement'
                  AND entry."referenceId" IN (
                    settlement.id,
                    settlement."settlementNumber"
                  )
                  AND entry.direction = 'CREDIT'
              )
          )::text AS seller_settlements_without_ledger,
          (
            SELECT COUNT(*) FROM seller_collections collection
            WHERE collection.status = 'POSTED'
              AND NOT EXISTS (
                SELECT 1 FROM ledger_entries entry
                WHERE entry."referenceType" = 'SellerCollection'
                  AND entry."referenceId" IN (
                    collection.id,
                    collection."collectionNumber"
                  )
                  AND entry.direction = 'DEBIT'
              )
          )::text AS seller_collections_without_ledger,
          (
            SELECT COUNT(*) FROM sales sale
            WHERE sale.status = 'COMPLETED'
              AND EXISTS (SELECT 1 FROM sale_items item WHERE item."saleId" = sale.id)
              AND NOT EXISTS (
                SELECT 1 FROM stock_movements movement
                WHERE movement."sourceType" = 'Sale'
                  AND movement."sourceId" IN (sale.id, sale."saleNumber")
              )
          )::text AS completed_sales_without_stock_movement,
          (
            SELECT COUNT(*) FROM purchases purchase
            WHERE purchase.status = 'POSTED'
              AND EXISTS (
                SELECT 1 FROM purchase_items item
                WHERE item."purchaseId" = purchase.id
              )
              AND NOT EXISTS (
                SELECT 1 FROM stock_movements movement
                WHERE movement."sourceType" = 'Purchase'
                  AND movement."sourceId" IN (
                    purchase.id,
                    purchase."purchaseNumber"
                  )
              )
          )::text AS posted_purchases_without_stock_movement
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
          transactionIntegrity: transactionIntegrity.rows[0],
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
