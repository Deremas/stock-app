import { describe, expect, it } from "vitest";

import {
  assertSufficientFinanceBalance,
  calculateFinanceAccountBalance,
  getCashTransferPostings,
  getPurchasePaymentPosting,
} from "./finance-ledger";

describe("finance ledger accounting", () => {
  it("adds debits and subtracts credits from an asset account", () => {
    expect(
      calculateFinanceAccountBalance([
        { direction: "DEBIT", amount: "2500.00" },
        { direction: "CREDIT", amount: 400 },
        { direction: "DEBIT", amount: 125.5 },
      ]),
    ).toBe(2225.5);
  });

  it("posts a cash-to-bank transfer out of cash and into bank", () => {
    expect(getCashTransferPostings(750)).toEqual({
      from: { direction: "CREDIT", amount: 750 },
      to: { direction: "DEBIT", amount: 750 },
    });
  });

  it("allows the full available balance but blocks overdrawing", () => {
    expect(() =>
      assertSufficientFinanceBalance({
        accountName: "Shop Cash",
        amount: 1000,
        availableBalance: 1000,
      }),
    ).not.toThrow();

    expect(() =>
      assertSufficientFinanceBalance({
        accountName: "Shop Cash",
        amount: 1000.01,
        availableBalance: 1000,
      }),
    ).toThrow("Shop Cash has only ETB 1000.00 available");
  });

  it("posts a direct purchase even when there is no supplier payment record", () => {
    expect(
      getPurchasePaymentPosting({
        amount: 500,
        purchaseId: "purchase-1",
        supplierPayment: null,
      }),
    ).toMatchObject({
      direction: "CREDIT",
      entryType: "PURCHASE",
      referenceType: "Purchase",
      referenceId: "purchase-1",
    });
  });

  it("links supplier purchase payments to their payment record", () => {
    expect(
      getPurchasePaymentPosting({
        amount: 500,
        purchaseId: "purchase-1",
        supplierPayment: {
          id: "payment-1",
          paymentNumber: "SPM-1",
        },
      }),
    ).toMatchObject({
      direction: "CREDIT",
      entryType: "SUPPLIER_PAYMENT",
      referenceType: "SupplierPayment",
      referenceId: "payment-1",
    });
  });
});
