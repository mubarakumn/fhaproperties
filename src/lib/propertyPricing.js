export function getPropertyPriceBreakdown(priceAmount, agentFeePercent = 0) {
  if (priceAmount == null || !Number.isFinite(Number(priceAmount))) {
    return null;
  }

  const baseAmount = Number(priceAmount);
  const feePercent = Number(agentFeePercent) || 0;
  const feeAmount = Math.round((baseAmount * feePercent) / 100);

  return {
    baseAmount,
    feeAmount,
    feePercent,
    totalAmount: baseAmount + feeAmount,
  };
}

export function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}
