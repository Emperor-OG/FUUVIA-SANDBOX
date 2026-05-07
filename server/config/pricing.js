const MARKUP_PERCENTAGE = Number(process.env.MARKUP_PERCENTAGE || 12);
const AFFILIATE_MARKUP = Number(process.env.AFFILIATE_MARKUP || 20);

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function getMarkupPrice(sellerPrice) {
  const safeSellerPrice = Number(sellerPrice || 0);
  return roundCurrency(
    safeSellerPrice + safeSellerPrice * (MARKUP_PERCENTAGE / 100)
  );
}

function getFinalPrice(markupPrice) {
  return roundCurrency(Number(markupPrice || 0) + AFFILIATE_MARKUP);
}

module.exports = {
  MARKUP_PERCENTAGE,
  AFFILIATE_MARKUP,
  roundCurrency,
  getMarkupPrice,
  getFinalPrice,
};
