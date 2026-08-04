import { describe, expect, it } from "vitest";

import { calculateTax } from "./tax";

describe("calculateTax", () => {
  it("leaves amounts unchanged when VAT is disabled", () => {
    expect(
      calculateTax({ amount: 100, enabled: false, rate: 15, priceMode: "EXCLUSIVE" }),
    ).toEqual({
      taxTreatment: "NONE",
      taxRate: 0,
      taxableAmount: 0,
      taxAmount: 0,
      netAmount: 100,
      total: 100,
      pricesIncludeTax: false,
    });
  });

  it("adds exclusive VAT to the net amount", () => {
    expect(
      calculateTax({ amount: 100, enabled: true, rate: 15, priceMode: "EXCLUSIVE" }),
    ).toMatchObject({
      taxableAmount: 100,
      taxAmount: 15,
      netAmount: 100,
      total: 115,
      pricesIncludeTax: false,
    });
  });

  it("extracts inclusive VAT without increasing the entered total", () => {
    expect(
      calculateTax({ amount: 115, enabled: true, rate: 15, priceMode: "INCLUSIVE" }),
    ).toMatchObject({
      taxableAmount: 100,
      taxAmount: 15,
      netAmount: 100,
      total: 115,
      pricesIncludeTax: true,
    });
  });
});
