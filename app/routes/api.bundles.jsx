import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Content-Type": "application/json",
  };

  if (!shopDomain || !productId) {
    return new Response(JSON.stringify({ bundle: null }), { headers });
  }

  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) return new Response(JSON.stringify({ bundle: null }), { headers });

  const bundles = await prisma.bundle.findMany({
    where: { shopId: shop.id, status: "ACTIVE" },
  });

  const normalizedProductId = productId.includes("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  // Match bundle where current product is in displayProducts (trigger pages)
  const matched = bundles.find((b) => {
    const displayProducts = b.displayProducts ?? [];
    return displayProducts.some((p) => p.id === normalizedProductId);
  });

  return new Response(JSON.stringify({ bundle: matched ?? null }), { headers });
};
