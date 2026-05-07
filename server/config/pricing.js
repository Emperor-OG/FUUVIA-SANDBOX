const AFFILIATE_MARKUP_PERCENT = Number(
  process.env.AFFILIATE_MARKUP_PERCENT || 5
);

const PRICE_TIERS = [
  { min: 0, max: 99, markup: 20 },
  { min: 100, max: 499, markup: 15 },
  { min: 500, max: 1999, markup: 12 },
  { min: 2000, max: Infinity, markup: 8 },
];

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function getTierMarkup(sellerPrice) {
  const safePrice = Number(sellerPrice || 0);

  const tier = PRICE_TIERS.find(
    (t) => safePrice >= t.min && safePrice <= t.max
  );

  return tier ? tier.markup : 0;
}

async function getCategoryMarkup(client, categoryName) {
  if (!categoryName) return null;

  const result = await client.query(
    `SELECT markup_percent
     FROM categories
     WHERE LOWER(name) = LOWER($1)
     LIMIT 1`,
    [categoryName]
  );

  if (!result.rows.length) return null;

  return Number(result.rows[0].markup_percent);
}

async function calculatePricing({
  client,
  sellerPrice,
  category,
}) {
  const safeSellerPrice = Number(sellerPrice || 0);

  let categoryMarkup = await getCategoryMarkup(
    client,
    category
  );

  if (categoryMarkup == null) {
    categoryMarkup = getTierMarkup(safeSellerPrice);
  }

  const affiliateMarkupPercent =
    AFFILIATE_MARKUP_PERCENT;

  const markupAmount =
    safeSellerPrice * (categoryMarkup / 100);

  const affiliateAmount =
    safeSellerPrice *
    (affiliateMarkupPercent / 100);

  const finalPrice =
    safeSellerPrice +
    markupAmount +
    affiliateAmount;

  return {
    seller_price: roundCurrency(safeSellerPrice),

    markup_percentage: roundCurrency(
      categoryMarkup
    ),

    affiliate_markup_percentage:
      roundCurrency(affiliateMarkupPercent),

    markup_price: roundCurrency(
      safeSellerPrice + markupAmount
    ),

    affiliate_markup_amount:
      roundCurrency(affiliateAmount),

    final_price: roundCurrency(finalPrice),
  };
}

module.exports = {
  PRICE_TIERS,
  AFFILIATE_MARKUP_PERCENT,
  calculatePricing,
  roundCurrency,
};
