import { describe, expect, it } from "vitest";

import {
  createDocumentNumber,
  normalizeOptionalString,
  parseInputDate,
} from "./helpers";
import { purchaseSchema } from "../validation/purchase";
import { saleSchema } from "../validation/sale";

describe("action helpers", () => {
  it("creates deterministic document number shape", () => {
    const value = createDocumentNumber("PUR", new Date("2026-03-19T10:00:00.000Z"));

    expect(value).toMatch(/^PUR-20260319-[A-F0-9]{8}$/);
  });

  it("normalizes blank optional strings to undefined", () => {
    expect(normalizeOptionalString("  ")).toBeUndefined();
    expect(normalizeOptionalString(" branch-note ")).toBe("branch-note");
  });

  it("parses valid dates and rejects invalid ones", () => {
    expect(parseInputDate("2026-03-19T10:00")).toBeInstanceOf(Date);
    expect(parseInputDate("not-a-date")).toBeNull();
  });
});

describe("sale validation", () => {
  it("rejects discount values above the unit price", () => {
    const result = saleSchema.safeParse({
      branchId: "branch-hq",
      customerId: "customer-1",
      paymentMethod: "CASH",
      soldAt: "2026-03-19T10:00",
      items: [
        {
          productId: "prd-1",
          quantity: 1,
          unitPrice: 100,
          discount: 120,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires a customer for credit sales", () => {
    const result = saleSchema.safeParse({
      branchId: "branch-hq",
      customerId: "",
      paymentMethod: "CREDIT",
      soldAt: "2026-03-19T10:00",
      items: [
        {
          productId: "prd-1",
          quantity: 1,
          unitPrice: 100,
          discount: 0,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a cash and bank split payment", () => {
    const result = saleSchema.safeParse({
      branchId: "branch-hq",
      customerId: "",
      paymentMethod: "MIXED",
      mixedCashAmount: 40,
      mixedCashAccountId: "cash-1",
      mixedBankAmount: 60,
      mixedBankAccountId: "bank-1",
      mixedCreditAmount: 0,
      soldAt: "2026-03-19T10:00",
      items: [
        { productId: "prd-1", quantity: 1, unitPrice: 100, discount: 0 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires a customer when a split payment contains credit", () => {
    const result = saleSchema.safeParse({
      branchId: "branch-hq",
      customerId: "",
      paymentMethod: "MIXED",
      mixedCashAmount: 40,
      mixedCashAccountId: "cash-1",
      mixedBankAmount: 0,
      mixedCreditAmount: 60,
      soldAt: "2026-03-19T10:00",
      items: [
        { productId: "prd-1", quantity: 1, unitPrice: 100, discount: 0 },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("purchase validation", () => {
  it("allows fully paid purchases without a supplier", () => {
    const result = purchaseSchema.safeParse({
      branchId: "branch-hq",
      supplierId: "",
      settlementMode: "FULL",
      paymentAccountId: "cash-1",
      amountPaid: 100,
      purchasedAt: "2026-03-19T10:00",
      items: [
        {
          productId: "prd-1",
          quantity: 1,
          unitCost: 100,
          sellingPrice: 120,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires a supplier for unpaid purchases", () => {
    const result = purchaseSchema.safeParse({
      branchId: "branch-hq",
      supplierId: "",
      settlementMode: "UNPAID",
      paymentAccountId: "",
      amountPaid: 0,
      purchasedAt: "2026-03-19T10:00",
      items: [
        {
          productId: "prd-1",
          quantity: 1,
          unitCost: 100,
          sellingPrice: 120,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
