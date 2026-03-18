import { prisma } from "../lib/prisma.server";
import { Outlet, useLoaderData, useRouteError, NavLink } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await prisma.shop.upsert({
    where: { shopDomain: session.shop },
    update: { isActive: true },
    create: {
      shopDomain: session.shop,
      accessToken: session.accessToken,
      scope: session.scope ?? "",
      isActive: true,
    },
  });
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <ui-nav-menu>
          <NavLink to="/app" end>Home</NavLink>
          <NavLink to="/app/funnels">Funnels</NavLink>
          <NavLink to="/app/bundles">Bundles</NavLink>
          <NavLink to="/app/analytics">Analytics</NavLink>
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
