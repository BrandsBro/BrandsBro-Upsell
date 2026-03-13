import { prisma } from "../lib/prisma.server";
// Public API endpoint — called by the storefront bundle widget
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId");

  if (!shop || !productId) {
    return Response.json({ bundle: null }, { status: 400 });
  }

  const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) return Response.json({ bundle: null }, { status: 404 });

  // Find active bundle that contains this product
  const bundles = await prisma.bundle.findMany({
    where: { shopId: shopRecord.id, status: "ACTIVE" },
  });

  const matchingBundle = bundles.find((b) => {
    const products = b.products ?? [];
    return products.some((p) => p.id === productId || p.id === `gid://shopify/Product/${productId}`);
  });

  return Response.json(
    { bundle: matchingBundle ?? null },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
};
