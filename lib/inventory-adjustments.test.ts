import { describe, expect, it } from "vitest";

import { calculateBatchQuantityAdjustment } from "./inventory-adjustments";

describe("calculateBatchQuantityAdjustment", () => {
  it("adds stock without changing sold or transferred quantities", () => {
    const result = calculateBatchQuantityAdjustment({
      originalQuantity: 10,
      existingAdjustment: 0,
      soldQuantity: 4,
      transferredQuantity: 1,
      quantityDelta: 3,
    });

    expect(result).toEqual({
      adjustedQuantityBefore: 10,
      adjustedQuantityAfter: 13,
      consumedQuantity: 5,
      remainingBefore: 5,
      remainingAfter: 8,
    });
  });

  it("allows reducing only unsold and unmoved stock", () => {
    const result = calculateBatchQuantityAdjustment({
      originalQuantity: 10,
      existingAdjustment: 2,
      soldQuantity: 5,
      transferredQuantity: 2,
      quantityDelta: -4,
    });

    expect(result.remainingBefore).toBe(5);
    expect(result.remainingAfter).toBe(1);
    expect(result.consumedQuantity).toBe(7);
  });

  it("rejects a correction that would rewrite consumed history", () => {
    expect(() =>
      calculateBatchQuantityAdjustment({
        originalQuantity: 10,
        existingAdjustment: 0,
        soldQuantity: 7,
        transferredQuantity: 2,
        quantityDelta: -2,
      }),
    ).toThrow("9 units already sold or moved");
  });
});
