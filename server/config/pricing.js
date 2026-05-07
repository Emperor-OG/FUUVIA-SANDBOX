const DEFAULT_MARKUP_PERCENTAGE = Number(
  process.env.MARKUP_PERCENTAGE || 12
);

// FIXED affiliate fee (R15 recommended per your design)
const AFFILIATE_MARKUP = Number(
  process.env.AFFILIATE_MARKUP || 15
);

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

/**
 * CORE PRICING ENGINE (CATEGORY SAFE + NULL SAFE)
 */
function calculateFinalPrice({
  sellerPrice,
  categoryMarkupPercent,
}) {
  const price = Number(sellerPrice || 0);

  // fallback system:
  // 1. category markup if exists
  // 2. fallback global markup
  const effectiveMarkup =
    categoryMarkupPercent == null ||
    isNaN(categoryMarkupPercent)
      ? DEFAULT_MARKUP_PERCENTAGE
      : Number(categoryMarkupPercent);

  const categoryAmount = price * (effectiveMarkup / 100);

  const final = price + categoryAmount + AFFILIATE_MARKUP;

  return roundCurrency(final);
}

module.exports = {
  DEFAULT_MARKUP_PERCENTAGE,
  AFFILIATE_MARKUP,
  roundCurrency,
  calculateFinalPrice,
};
