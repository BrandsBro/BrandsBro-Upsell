import { useLoaderData, useNavigate, Outlet, useMatches, useFetcher } from "react-router";
import {
  Page, Layout, Card, Text, BlockStack, Badge,
  IndexTable, EmptyState, useIndexResourceState, Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { bundles: [] };
  const bundles = await prisma.bundle.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });
  return { bundles };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const formData = await request.formData();
  const bundleId = String(formData.get("bundleId"));
  await prisma.bundle.deleteMany({ where: { id: bundleId, shopId: shop.id } });
  return { success: true };
};

export default function BundlesPage() {
  const { bundles } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const matches = useMatches();
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(bundles);

  const isChildRoute = matches.some(m => m.id === "routes/app.bundles.$id");
  if (isChildRoute) return <Outlet />;

  const handleDelete = (bundleId) => {
    if (confirm("Are you sure you want to delete this bundle?")) {
      fetcher.submit({ bundleId }, { method: "post" });
    }
  };

  const rowMarkup = bundles.map((bundle, index) => {
    const products = bundle.products ?? [];
    return (
      <IndexTable.Row
        id={bundle.id} key={bundle.id}
        selected={selectedResources.includes(bundle.id)}
        position={index}
      >
        <IndexTable.Cell>
          <button
            onClick={() => navigate(`/app/bundles/${bundle.id}`)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Text fontWeight="bold" as="span">{bundle.name}</Text>
          </button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={bundle.status === "ACTIVE" ? "success" : "attention"}>
            {bundle.status.charAt(0) + bundle.status.slice(1).toLowerCase()}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{products.length} products</IndexTable.Cell>
        <IndexTable.Cell>
          {bundle.discountValue > 0 ? `${bundle.discountValue}${bundle.discountType === "PERCENTAGE" ? "%" : "$"} off` : "No discount"}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={bundle.showOnProduct ? "success" : undefined}>
            {bundle.showOnProduct ? "On" : "Off"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={bundle.showOnCart ? "success" : undefined}>
            {bundle.showOnCart ? "On" : "Off"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(bundle.createdAt).toLocaleDateString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            tone="critical"
            variant="plain"
            onClick={() => handleDelete(bundle.id)}
          >
            Delete
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Bundles"
      primaryAction={{ content: "Create bundle", onAction: () => navigate("/app/bundles/new") }}
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {bundles.length === 0 ? (
              <EmptyState
                heading="Create your first product bundle"
                action={{ content: "Create bundle", onAction: () => navigate("/app/bundles/new") }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Bundles combine multiple products at a discount and show on product and cart pages.</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: "bundle", plural: "bundles" }}
                itemCount={bundles.length}
                selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Name" }, { title: "Status" }, { title: "Products" },
                  { title: "Discount" }, { title: "Product page" }, { title: "Cart page" },
                  { title: "Created" }, { title: "Actions" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
