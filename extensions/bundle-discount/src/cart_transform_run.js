export function cartTransformRun(input) {
  const lines = input.cart.lines;
  const bundleAttr = input.cart.attribute?.value;

  // No bundle data in cart = no discount
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

    // Check if ALL bundle products are in cart
    const cartProductIds = lines.map(l => l.merchandise.product?.id);
    const allInCart = productIds.every(id => cartProductIds.includes(id));

    if (!allInCart) continue;

    // Apply discount to each bundle product line
    for (const line of lines) {
      const productId = line.merchandise.product?.id;
      if (!productIds.includes(productId)) continue;

      const originalPrice = parseFloat(line.merchandise.price.amount);
      let discountedPrice;

      if (discountType === "PERCENTAGE") {
        discountedPrice = originalPrice * (1 - discountValue / 100);
      } else {
        // FIXED - split fixed discount across products equally
        discountedPrice = Math.max(0, originalPrice - discountValue / productIds.length);
      }

      operations.push({
        update: {
          cartLineId: line.id,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: discountedPrice.toFixed(2),
                currencyCode: line.merchandise.price.currencyCode,
              }
            }
          },
          title: `Bundle discount (${discountType === "PERCENTAGE" ? discountValue + "%" : "$" + discountValue} off)`,
        }
      });
    }
  }

  return { operations };
}
