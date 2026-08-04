export type TaxPriceMode = "EXCLUSIVE" | "INCLUSIVE";

export type TaxCalculation = {
  taxTreatment: "NONE" | "STANDARD";
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  netAmount: number;
  total: number;
  pricesIncludeTax: boolean;
};

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTax(args: {
  amount: number;
  enabled: boolean;
  rate: number;
  priceMode: TaxPriceMode;
}): TaxCalculation {
  const amount = roundCurrency(Math.max(0, args.amount));
  const rate = roundCurrency(Math.max(0, args.rate));

  if (!args.enabled || rate <= 0 || amount <= 0) {
    return {
      taxTreatment: "NONE",
      taxRate: 0,
      taxableAmount: 0,
      taxAmount: 0,
      netAmount: amount,
      total: amount,
      pricesIncludeTax: false,
    };
  }

  if (args.priceMode === "INCLUSIVE") {
    const taxAmount = roundCurrency((amount * rate) / (100 + rate));
    const netAmount = roundCurrency(amount - taxAmount);

    return {
      taxTreatment: "STANDARD",
      taxRate: rate,
      taxableAmount: netAmount,
      taxAmount,
      netAmount,
      total: amount,
      pricesIncludeTax: true,
    };
  }

  const taxAmount = roundCurrency((amount * rate) / 100);

  return {
    taxTreatment: "STANDARD",
    taxRate: rate,
    taxableAmount: amount,
    taxAmount,
    netAmount: amount,
    total: roundCurrency(amount + taxAmount),
    pricesIncludeTax: false,
  };
}
