import { describe, expect, it } from "vitest";

import {
  createDocumentNumber,
  normalizeOptionalString,
  parseInputDate,
} from "./helpers";
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
});
