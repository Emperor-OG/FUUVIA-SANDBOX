const DEFAULT_MARKUP_PERCENTAGE = Number(
  process.env.MARKUP_PERCENTAGE || 12
);

const AFFILIATE_MARKUP = Number(process.env.AFFILIATE_MARKUP || 15);

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

/**
 * Core pricing engine (SAFE + FALLBACK READY)
 */
function calculateFinalPrice({
  sellerPrice,
  categoryMarkupPercent,
}) {
  const safeSellerPrice = Number(sellerPrice || 0);

  // fallback logic
  const effectiveMarkup =
    categoryMarkupPercent == null
      ? DEFAULT_MARKUP_PERCENTAGE
      : Number(categoryMarkupPercent);

  const categoryAmount =
    safeSellerPrice * (effectiveMarkup / 100);

  const final =
    safeSellerPrice + categoryAmount + AFFILIATE_MARKUP;

  return roundCurrency(final);
}

module.exports = {
  DEFAULT_MARKUP_PERCENTAGE,
  AFFILIATE_MARKUP,
  roundCurrency,
  calculateFinalPrice,
};
