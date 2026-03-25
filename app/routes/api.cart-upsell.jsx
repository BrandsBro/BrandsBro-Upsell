import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!shopDomain) return new Response(JSON.stringify({ products: [] }), { headers });

  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) return new Response(JSON.stringify({ products: [] }), { headers });

  return new Response(JSON.stringify({ products: shop.cartUpsellProducts ?? [] }), { headers });
};
