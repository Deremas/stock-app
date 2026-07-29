import { AccountsClient } from "./accounts-client";
import { getFinanceAccountFormOptions } from "@/lib/form-options";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/data-runtime-utils";
import { LedgerEntryType } from "@/generated/prisma/enums";

type RouteSearchParams = {
  accountId?: string | string[];
  type?: string | string[];
  branch?: string | string[];
  q?: string | string[];
};

type PageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const canViewAll = user && hasPermission(user.role, "branch:view-all");
  const activeBranchId = canViewAll ? undefined : user?.activeBranchId;

  // 1. Get finance account form options
  const options = await getFinanceAccountFormOptions();

  // 2. Fetch all active branches for filter dropdown
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 3. Fetch all finance accounts with ledger entries to compute correct balance
  const dbAccounts = await prisma.financeAccount.findMany({
    orderBy: { name: "asc" },
    include: {
      ledgerEntries: {
        ...(activeBranchId ? { where: { branchId: activeBranchId } } : {}),
        select: {
          amount: true,
          direction: true,
        },
      },
    },
  });

  const accounts = dbAccounts.map((acc) => {
    const balance = acc.ledgerEntries.reduce((sum, entry) => {
      const amount = toNumber(entry.amount);
      return entry.direction === "DEBIT" ? sum + amount : sum - amount;
    }, 0);

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      isActive: acc.isActive,
      balance,
    };
  });

  // 4. Parse transaction parameters
  const query = params?.q ? String(params.q).trim() : "";
  const filterAccountId = params?.accountId ? String(params.accountId) : undefined;
  const filterType = params?.type ? String(params.type) : undefined;
  const filterBranchId = params?.branch ? String(params.branch) : undefined;

  // 5. Fetch transaction ledger entries
  const resolvedBranchId =
    activeBranchId ||
    (filterBranchId && filterBranchId !== "all" ? filterBranchId : undefined);
  const resolvedAccountId =
    filterAccountId && filterAccountId !== "all" ? filterAccountId : undefined;
  const resolvedEntryType =
    filterType &&
    filterType !== "all" &&
    Object.values(LedgerEntryType).includes(filterType as LedgerEntryType)
      ? (filterType as LedgerEntryType)
      : undefined;

  const dbTransactions = await prisma.ledgerEntry.findMany({
    where: {
      ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
      ...(resolvedAccountId ? { financeAccountId: resolvedAccountId } : {}),
      ...(resolvedEntryType ? { entryType: resolvedEntryType } : {}),
      ...(query
        ? {
            OR: [
              { description: { contains: query, mode: "insensitive" } },
              { referenceId: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { entryDate: "desc" },
    include: {
      branch: { select: { name: true } },
      financeAccount: { select: { name: true, type: true } },
    },
  });

  const transactions = dbTransactions.map((t) => ({
    id: t.id,
    entryDate: t.entryDate.toISOString(),
    branch: t.branch?.name ?? "Global",
    accountName: t.financeAccount?.name ?? "Unknown",
    type: t.entryType,
    direction: t.direction as "DEBIT" | "CREDIT",
    amount: toNumber(t.amount),
    reference: t.referenceId,
    description: t.description,
  }));

  return (
    <AccountsClient
      accounts={accounts}
      transactions={transactions}
      options={options}
      branches={branches}
    />
  );
}
