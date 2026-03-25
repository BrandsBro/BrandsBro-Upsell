export function cartLinesDiscountsGenerateRun(input) {
  const lines = input.cart.lines;
  const bundleAttr = input.cart.attribute?.value;

  if (!bundleAttr) return { operations: [] };

  let bundles;
  try {
    bundles = JSON.parse(bundleAttr);
  } catch (e) {
    return { operations: [] };
  }

  const operations = [];

  for (const bundle of bundles) {
    const { productIds, discountType, discountValue } = bundle;

    const cartProductIds = lines.map(l => l.merchandise.product?.id);
    const allInCart = productIds.every(id => cartProductIds.includes(id));

    if (!allInCart) continue;

    const matchingLines = lines.filter(l => productIds.includes(l.merchandise.product?.id));

    const candidates = matchingLines.map(l => ({
      message: `Bundle Discount`,
      targets: [{ cartLine: { id: l.id } }],
      value: discountType === "PERCENTAGE"
        ? { percentage: { value: parseFloat(discountValue) } }
        : { fixedAmount: { amount: parseFloat((discountValue / matchingLines.length).toFixed(2)), appliesToEachItem: false } }
    }));

    operations.push({
      productDiscountsAdd: {
        candidates,
        selectionStrategy: "ALL",
      }
    });
  }

  return { operations };
}
