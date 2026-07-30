import { prisma } from "@/lib/prisma";
import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import type { RowActionConfig, SimpleRow } from "@/lib/table";
import type { BranchRow, MetricCard } from "@/lib/types";
import { getUserLoginLabel } from "@/lib/user-login";
import { ARCHIVED_USER_USERNAME_PREFIX } from "@/lib/user-archive";
import { sumRows, toNumber } from "@/lib/data-runtime-utils";
import { formatCurrency } from "@/lib/utils";
import { startOfDay, startOfMonth, startOfWeek } from "date-fns";

type PurchaseFilters = {
  supplierId?: string;
  branchId?: string;
};

type FinanceAccountFilters = {
  branchId?: string;
  accountType?: "CASH" | "BANK";
};

type ExpenseDateFilters = {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

function withFilter(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function createRowAction(action: RowActionConfig) {
  return action;
}

function getDateRangeFilter(filters: Pick<ExpenseDateFilters, "dateFrom" | "dateTo">) {
  if (!filters.dateFrom && !filters.dateTo) {
    return undefined;
  }

  const range: {
    gte?: Date;
    lte?: Date;
  } = {};

  if (filters.dateFrom) {
    const parsedDate = new Date(filters.dateFrom);

    if (!Number.isNaN(parsedDate.getTime())) {
      range.gte = parsedDate;
    }
  }

  if (filters.dateTo) {
    const parsedDate = new Date(filters.dateTo);

    if (!Number.isNaN(parsedDate.getTime())) {
      parsedDate.setHours(23, 59, 59, 999);
      range.lte = parsedDate;
    }
  }

  return Object.keys(range).length > 0 ? range : undefined;
}

export async function getPurchaseRows(filters: PurchaseFilters = {}) {
  const purchases = await prisma.purchase.findMany({
    where: {
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    orderBy: {
      purchasedAt: "desc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      supplier: {
        select: {
          name: true,
        },
      },
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          quantity: true,
          unitCost: true,
          sellingPrice: true,
          lineTotal: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return purchases.map(
    (purchase) => {
      const totalQuantity = purchase.items.reduce(
        (sum, item) => sum + Number(item.quantity ?? 0),
        0,
      );
      const itemLines =
        purchase.items.length > 0
          ? [
              `${purchase.items.length} line${purchase.items.length === 1 ? "" : "s"} | ${totalQuantity} qty`,
              ...purchase.items.map(
                (item) =>
                  `${item.product.name} | ${item.quantity} qty | Buy ${formatCurrency(toNumber(item.unitCost))} | Sell ${formatCurrency(toNumber(item.sellingPrice))} | Line ${formatCurrency(toNumber(item.lineTotal))}`,
              ),
            ].join("\n")
          : "No line items";

      return {
        id: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        branch: purchase.branch.name,
        supplier: purchase.supplier?.name ?? "No supplier",
        itemsPurchased: itemLines,
        total: toNumber(purchase.total),
        amountDue: toNumber(purchase.amountDue),
        paymentStatus: purchase.paymentStatus,
        purchasedAt: purchase.purchasedAt.toISOString(),
      } satisfies SimpleRow;
    },
  );
}

export async function getSupplierRows(branchId?: string) {
  const suppliers = await prisma.supplier.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      note: true,
      isActive: true,
      purchases: {
        where: {
          ...(branchId ? { branchId } : {}),
        },
        select: {
          amountDue: true,
        },
      },
    },
  });

  return suppliers.map(
    (supplier) => {
      const payableBalance = sumRows(
        supplier.purchases.map((purchase) => toNumber(purchase.amountDue)),
      );

      return {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone ?? "-",
        location: supplier.address ?? "-",
        note: supplier.note ?? "-",
        payableBalance,
        purchasesCount: supplier.purchases.length,
        status: supplier.isActive ? "ACTIVE" : "INACTIVE",
        __actions: [
          ...(payableBalance > 0
            ? [
                createRowAction({
                  key: "pay",
                  label: "Pay",
                  href: withFilter("/purchases/supplier-payments", {
                    supplierId: supplier.id,
                    q: supplier.name,
                    open: "1",
                  }),
                  icon: "supplierPayments",
                }),
              ]
            : []),
          createRowAction({
            key: "purchases",
            label: "Purchases",
            href: withFilter("/purchases/list", {
              supplierId: supplier.id,
              q: supplier.name,
            }),
            icon: "purchaseList",
          }),
          createRowAction({
            key: "payments",
            label: "Payments",
            href: withFilter("/purchases/supplier-payments", {
              supplierId: supplier.id,
              q: supplier.name,
            }),
            icon: "supplierPayments",
          }),
        ],
      } satisfies SimpleRow;
    },
  );
}

export async function getSupplierPaymentRows(filters: PurchaseFilters = {}) {
  const rows = await prisma.supplierPayment.findMany({
    where: {
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    orderBy: {
      paymentDate: "desc",
    },
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
      purchase: {
        select: {
          purchaseNumber: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
      financeAccount: {
        select: {
          name: true,
          type: true,
          bankName: true,
          accountNumber: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        paymentNumber: row.paymentNumber,
        supplier: row.supplier.name,
        branch: row.branch.name,
        account: formatFinanceAccountLabel(row.financeAccount),
        amount: toNumber(row.amount),
        appliedTo: row.purchase?.purchaseNumber ?? "-",
        paidAt: row.paymentDate.toISOString(),
        status: "POSTED",
      }) satisfies SimpleRow,
  );
}

export async function getFinanceAccountRows(filters: FinanceAccountFilters = {}) {
  const rows = await prisma.financeAccount.findMany({
    where: {
      ...(filters.branchId
        ? {
            OR: [{ branchId: null }, { branchId: filters.branchId }],
          }
        : {}),
      ...(filters.accountType ? { type: filters.accountType } : {}),
    },
    orderBy: {
      name: "asc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      ledgerEntries: {
        where: {
          ...(filters.branchId
            ? {
                OR: [{ branchId: null }, { branchId: filters.branchId }],
              }
            : {}),
        },
        select: {
          amount: true,
          direction: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        bankName: row.bankName ?? "-",
        accountNumber: row.accountNumber ?? "-",
        branch: row.branch?.name ?? "-",
        balance: row.ledgerEntries.reduce((sum, entry) => {
          const amount = toNumber(entry.amount);
          return entry.direction === "DEBIT" ? sum + amount : sum - amount;
        }, 0),
        status: row.isActive ? "ACTIVE" : "INACTIVE",
        __actions: [
          ...(row.type === "CASH"
            ? [
                createRowAction({
                  key: "deposit",
                  label: "Deposit",
                  href: withFilter("/finance/cash", {
                    cashAccountId: row.id,
                    q: row.name,
                    open: "1",
                  }),
                  icon: "cashTransfers",
                }),
              ]
            : []),
          createRowAction({
            key: "ledger",
            label: "Ledger",
            href: withFilter("/finance/ledger", {
              q: row.name,
            }),
            icon: "ledger",
          }),
          createRowAction({
            key: "edit",
            label: "Edit",
            href: withFilter("/finance/accounts", {
              editAccountId: row.id,
              open: "edit",
            }),
            icon: "edit",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getCashAccountRows(branchId?: string) {
  return getFinanceAccountRows({
    ...(branchId ? { branchId } : {}),
    accountType: "CASH",
  });
}

export async function getCashTransferRows(branchId?: string) {
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      entryType: "CASH_TRANSFER",
      ...(branchId ? { branchId } : {}),
    },
    orderBy: {
      entryDate: "desc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      financeAccount: {
        select: {
          name: true,
          type: true,
          bankName: true,
          accountNumber: true,
        },
      },
    },
  });

  const transferMap = new Map<
    string,
    {
      id: string;
      transferNumber: string;
      fromAccount: string;
      toAccount: string;
      branch: string;
      amount: number;
      transferDate: string;
      status: string;
      debitAmount: number;
      creditAmount: number;
    }
  >();

  for (const row of rows) {
    const existing = transferMap.get(row.referenceId) ?? {
      id: row.referenceId,
      transferNumber: row.referenceId,
      fromAccount: "-",
      toAccount: "-",
      branch: row.branch?.name ?? "-",
      amount: toNumber(row.amount),
      transferDate: row.entryDate.toISOString(),
      status: "INCOMPLETE",
      debitAmount: 0,
      creditAmount: 0,
    };

    if (row.direction === "CREDIT") {
      existing.fromAccount = row.financeAccount
        ? formatFinanceAccountLabel(row.financeAccount)
        : "-";
      existing.creditAmount += toNumber(row.amount);
    } else {
      existing.toAccount = row.financeAccount
        ? formatFinanceAccountLabel(row.financeAccount)
        : "-";
      existing.debitAmount += toNumber(row.amount);
    }

    existing.amount = Math.max(existing.creditAmount, existing.debitAmount);
    existing.status =
      existing.creditAmount > 0 &&
      existing.debitAmount > 0 &&
      Math.abs(existing.creditAmount - existing.debitAmount) < 0.005
        ? "POSTED"
        : "INCOMPLETE";

    if (row.entryDate.toISOString() > existing.transferDate) {
      existing.transferDate = row.entryDate.toISOString();
    }

    transferMap.set(row.referenceId, existing);
  }

  return [...transferMap.values()]
    .map(({ debitAmount: _debitAmount, creditAmount: _creditAmount, ...row }) => row)
    .sort((left, right) =>
      right.transferDate.localeCompare(left.transferDate),
    );
}

export async function getExpenseRows(branchId?: string) {
  const rows = await prisma.expense.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
    },
    orderBy: {
      expenseDate: "desc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      financeAccount: {
        select: {
          name: true,
          type: true,
          bankName: true,
          accountNumber: true,
        },
      },
      expenseCategory: {
        select: {
          name: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        expenseNumber: row.expenseNumber,
        branch: row.branch.name,
        category: row.expenseCategory.name,
        name: row.name,
        account: formatFinanceAccountLabel(row.financeAccount),
        amount: toNumber(row.amount),
        expenseDate: row.expenseDate.toISOString(),
      }) satisfies SimpleRow,
  );
}

export async function getExpenseCategorySummaryRows(filters: ExpenseDateFilters = {}) {
  const expenseDate = getDateRangeFilter(filters);
  const rows = await prisma.expense.findMany({
    where: {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(expenseDate ? { expenseDate } : {}),
    },
    orderBy: {
      expenseDate: "desc",
    },
    include: {
      expenseCategory: {
        select: {
          name: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  const summary = new Map<
    string,
    {
      id: string;
      category: string;
      branch: string;
      entries: number;
      totalAmount: number;
      lastExpenseAt: string;
    }
  >();

  for (const row of rows) {
    const key = `${row.branchId}:${row.expenseCategoryId}`;
    const existing = summary.get(key) ?? {
      id: key,
      category: row.expenseCategory.name,
      branch: row.branch.name,
      entries: 0,
      totalAmount: 0,
      lastExpenseAt: row.expenseDate.toISOString(),
    };

    existing.entries += 1;
    existing.totalAmount = Number(
      (existing.totalAmount + toNumber(row.amount)).toFixed(2),
    );

    if (row.expenseDate.toISOString() > existing.lastExpenseAt) {
      existing.lastExpenseAt = row.expenseDate.toISOString();
    }

    summary.set(key, existing);
  }

  return [...summary.values()].sort((left, right) => right.totalAmount - left.totalAmount);
}

export async function getExpenseKpis(branchId?: string): Promise<MetricCard[]> {
  const rows = await prisma.expense.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
    },
    select: {
      amount: true,
      expenseDate: true,
      expenseCategory: {
        select: {
          name: true,
        },
      },
    },
  });

  const now = new Date();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const totalToday = sumRows(
    rows
      .filter((row) => row.expenseDate >= dayStart)
      .map((row) => toNumber(row.amount)),
  );
  const totalWeek = sumRows(
    rows
      .filter((row) => row.expenseDate >= weekStart)
      .map((row) => toNumber(row.amount)),
  );
  const totalMonth = sumRows(
    rows
      .filter((row) => row.expenseDate >= monthStart)
      .map((row) => toNumber(row.amount)),
  );
  const categoryTotals = new Map<string, number>();

  for (const row of rows) {
    const current = categoryTotals.get(row.expenseCategory.name) ?? 0;
    categoryTotals.set(
      row.expenseCategory.name,
      Number((current + toNumber(row.amount)).toFixed(2)),
    );
  }

  const topCategory =
    [...categoryTotals.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;

  return [
    {
      title: "Today",
      value: `ETB ${totalToday.toLocaleString("en-ET", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      title: "This Week",
      value: `ETB ${totalWeek.toLocaleString("en-ET", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      title: "This Month",
      value: `ETB ${totalMonth.toLocaleString("en-ET", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      title: "Top Category",
      value: topCategory?.[0] ?? "No expenses",
      ...(topCategory
        ? {
            meta: `ETB ${topCategory[1].toLocaleString("en-ET", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          }
        : {}),
    },
  ];
}

export async function getLedgerRows(branchId?: string) {
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      ...(branchId
        ? {
            OR: [{ branchId: null }, { branchId }],
          }
        : {}),
    },
    orderBy: {
      entryDate: "desc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      financeAccount: {
        select: {
          name: true,
          type: true,
          bankName: true,
          accountNumber: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        entryDate: row.entryDate.toISOString(),
        branch: row.branch?.name ?? "-",
        account: row.financeAccount ? formatFinanceAccountLabel(row.financeAccount) : "-",
        type: row.entryType,
        direction: row.direction,
        amount: toNumber(row.amount),
        reference: row.referenceId,
      }) satisfies SimpleRow,
  );
}

export async function getUserRows() {
  const rows = await prisma.user.findMany({
    where: {
      NOT: {
        username: {
          startsWith: ARCHIVED_USER_USERNAME_PREFIX,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      displayUsername: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      defaultBranch: {
        select: {
          name: true,
        },
      },
      branchAssignments: {
        where: {
          isActive: true,
        },
        orderBy: [{ isDefault: "desc" }, { branch: { name: "asc" } }],
        select: {
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        name: row.displayName ?? row.name,
        username: getUserLoginLabel(row),
        role: row.role,
        defaultBranch: row.defaultBranch?.name ?? "-",
        branches:
          row.branchAssignments.map((assignment) => assignment.branch.name).join(", ") ||
          "-",
        status: row.isActive ? "ACTIVE" : "INACTIVE",
      }) satisfies SimpleRow,
  );
}

export async function getRoleRows() {
  const users = await prisma.user.findMany({
    where: {
      NOT: {
        username: {
          startsWith: ARCHIVED_USER_USERNAME_PREFIX,
        },
      },
    },
    select: {
      role: true,
    },
  });

  const countByRole = new Map<string, number>();
  for (const user of users) {
    countByRole.set(user.role, (countByRole.get(user.role) ?? 0) + 1);
  }

  return [
    {
      id: "ADMIN",
      role: "ADMIN",
      userCount: countByRole.get("ADMIN") ?? 0,
      scope: "Full platform access",
      status: "ACTIVE",
    },
    {
      id: "SALES",
      role: "SALES",
      userCount: countByRole.get("SALES") ?? 0,
      scope: "Sales and operational workflows",
      status: "ACTIVE",
    },
  ] satisfies SimpleRow[];
}

export async function getBranchRows(): Promise<BranchRow[]> {
  const branches = await prisma.branch.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      location: true,
      isActive: true,
    },
  });

  return branches.map((branch) => ({
    id: branch.id,
    code: branch.code,
    name: branch.name,
    location: branch.location ?? "-",
    stockValue: 0,
    status: branch.isActive ? "ACTIVE" : "INACTIVE",
  }));
}

export async function getAuditLogRows(branchId?: string) {
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      actor: {
        select: {
          name: true,
          displayName: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actor: row.actor?.displayName ?? row.actor?.name ?? "System",
        branch: row.branch?.name ?? "-",
        createdAt: row.createdAt.toISOString(),
      }) satisfies SimpleRow,
  );
}
