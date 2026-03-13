import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED": {
      await prisma.shop.update({
        where: { shopDomain: shop },
        data: { isActive: false, uninstalledAt: new Date() },
      });
      break;
    }
    case "ORDERS_PAID": {
      console.log(`Order paid for shop: ${shop}`, payload);
      break;
    }
    case "CUSTOMERS_DATA_REQUEST": {
      console.log("Customer data request received:", shop);
      break;
    }
    case "CUSTOMERS_REDACT": {
      const customerId = payload?.customer?.id;
      if (customerId) {
        await prisma.upsellEvent.deleteMany({ where: { customerId: String(customerId) } });
      }
      break;
    }
    case "SHOP_REDACT": {
      const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
      if (shopRecord) {
        await prisma.upsellEvent.deleteMany({ where: { shopId: shopRecord.id } });
        await prisma.funnel.deleteMany({ where: { shopId: shopRecord.id } });
        await prisma.shop.delete({ where: { shopDomain: shop } });
      }
      break;
    }
  }

  return new Response("OK", { status: 200 });
};
