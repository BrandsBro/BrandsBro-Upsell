import { prisma } from "../lib/prisma.server";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const host = url.searchParams.get("host") || "";

  await prisma.shop.upsert({
    where: { shopDomain: session.shop },
    update: { isActive: true, accessToken: session.accessToken },
    create: {
      shopDomain: session.shop,
      accessToken: session.accessToken,
      scope: session.scope ?? "",
      isActive: true,
    },
  });

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    host,
    shop: session.shop,
  };
};

export default function App() {
  const { apiKey, host, shop } = useLoaderData();
  return (
    <ShopifyAppProvider embedded apiKey={apiKey} host={host} shop={shop}>
      <PolarisAppProvider i18n={enTranslations}>
        <ui-nav-menu>
          <a href="/app" rel="home">Home</a>
          <a href="/app/funnels">Funnels</a>
          <a href="/app/bundles">Bundles</a>
          <a href="/app/analytics">Analytics</a>
        </ui-nav-menu>
        <Outlet />
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
