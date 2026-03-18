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
  let host = url.searchParams.get("host") || "";

  // Read host from cookie if not in URL
  const cookieHeader = request.headers.get("Cookie") || "";
  if (!host) {
    const match = cookieHeader.match(/shopify_host=([^;]+)/);
    if (match) host = decodeURIComponent(match[1]);
  }

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

  const headers = new Headers();
  if (url.searchParams.get("host")) {
    headers.append("Set-Cookie", `shopify_host=${encodeURIComponent(host)}; Path=/; SameSite=None; Secure`);
  }

  return new Response(
    JSON.stringify({ apiKey: process.env.SHOPIFY_API_KEY || "", host, shop: session.shop }),
    { headers: { "Content-Type": "application/json", ...Object.fromEntries(headers) } }
  );
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
