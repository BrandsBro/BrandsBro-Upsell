import { useLoaderData } from "react-router";
import { Page, Layout, Card, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  if (params.id && params.id !== "new") {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    const bundle = await prisma.bundle.findFirst({
      where: { id: params.id, shopId: shop?.id },
    });
    return { bundle, isNew: false };
  }
  return { bundle: null, isNew: true };
};

export default function BundleFormPage() {
  const { bundle, isNew } = useLoaderData();
  return (
    <Page title={isNew ? "Create bundle" : `Edit: ${bundle?.name}`}>
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="p">Bundle form is working! isNew: {String(isNew)}</Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
