import {
  LedgerDirection,
  LedgerEntryType,
} from "../generated/prisma/enums";

type LedgerBalanceEntry = {
  amount: unknown;
  direction: "DEBIT" | "CREDIT";
};

export function calculateFinanceAccountBalance(entries: LedgerBalanceEntry[]) {
  return Number(
    entries
      .reduce((sum, entry) => {
        const amount = Number(entry.amount ?? 0);
        return entry.direction === LedgerDirection.DEBIT
          ? sum + amount
          : sum - amount;
      }, 0)
      .toFixed(2),
  );
}

export function assertSufficientFinanceBalance({
  accountName,
  amount,
  availableBalance,
}: {
  accountName: string;
  amount: number;
  availableBalance: number;
}) {
  if (Number(amount.toFixed(2)) > Number(availableBalance.toFixed(2))) {
    throw new Error(
      `${accountName} has only ETB ${availableBalance.toFixed(2)} available.`,
    );
  }
}

export function getCashTransferPostings(amount: number) {
  return {
    from: {
      direction: LedgerDirection.CREDIT,
      amount,
    },
    to: {
      direction: LedgerDirection.DEBIT,
      amount,
    },
  } as const;
}

export function getPurchasePaymentPosting({
  amount,
  purchaseId,
  supplierPayment,
}: {
  amount: number;
  purchaseId: string;
  supplierPayment?: {
    id: string;
    paymentNumber: string;
  } | null;
}) {
  return {
    direction: LedgerDirection.CREDIT,
    amount,
    entryType: supplierPayment
      ? LedgerEntryType.SUPPLIER_PAYMENT
      : LedgerEntryType.PURCHASE,
    referenceType: supplierPayment ? "SupplierPayment" : "Purchase",
    referenceId: supplierPayment?.id ?? purchaseId,
  } as const;
}
