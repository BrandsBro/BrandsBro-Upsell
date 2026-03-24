export function cartLinesDiscountsGenerateRun(input) {
  const lines = input.cart.lines;
  const bundleAttr = input.cart.attribute?.value;

  if (!bundleAttr) return { discounts: [], discountApplicationStrategy: "FIRST" };

  let bundles;
  try {
    bundles = JSON.parse(bundleAttr);
  } catch (e) {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  const discounts = [];

  for (const bundle of bundles) {
    const { productIds, discountType, discountValue } = bundle;

    const cartProductIds = lines.map(l => l.merchandise.product?.id);
    const allInCart = productIds.every(id => cartProductIds.includes(id));

    if (!allInCart) continue;

    const matchingLines = lines.filter(l => productIds.includes(l.merchandise.product?.id));

    if (discountType === "PERCENTAGE") {
      discounts.push({
        targets: matchingLines.map(l => ({
          cartLine: { id: l.id }
        })),
        value: {
          percentage: { value: discountValue.toString() }
        },
        message: `Bundle Discount (${discountValue}% off)`,
      });
    } else {
      // FIXED - split across matching lines
      const perItem = (discountValue / matchingLines.length).toFixed(2);
      discounts.push({
        targets: matchingLines.map(l => ({
          cartLine: { id: l.id }
        })),
        value: {
          fixedAmount: {
            amount: perItem,
            appliesToEachItem: true,
          }
        },
        message: `Bundle Discount ($${discountValue} off)`,
      });
    }
  }

  return {
    discounts,
    discountApplicationStrategy: "FIRST",
  };
}
