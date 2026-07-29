export function calculateBatchQuantityAdjustment(input: {
  originalQuantity: number;
  existingAdjustment: number;
  soldQuantity: number;
  transferredQuantity: number;
  quantityDelta: number;
}) {
  const adjustedQuantityBefore =
    input.originalQuantity + input.existingAdjustment;
  const consumedQuantity = input.soldQuantity + input.transferredQuantity;
  const remainingBefore = adjustedQuantityBefore - consumedQuantity;
  const adjustedQuantityAfter =
    adjustedQuantityBefore + input.quantityDelta;
  const remainingAfter = adjustedQuantityAfter - consumedQuantity;

  if (remainingAfter < 0) {
    throw new Error(
      `Quantity cannot be reduced below the ${consumedQuantity} units already sold or moved.`,
    );
  }

  return {
    adjustedQuantityBefore,
    adjustedQuantityAfter,
    consumedQuantity,
    remainingBefore,
    remainingAfter,
  };
}
