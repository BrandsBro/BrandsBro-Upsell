import { redirect } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import {
  Page, Layout, Card, Text, Button, BlockStack, InlineStack,
  TextField, Select, Checkbox, Banner, Divider, Badge,
  Thumbnail, ResourceList, ResourceItem, ChoiceList,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      products(first: 50) {
        edges {
          node {
            id
            title
            featuredImage { url }
            variants(first: 1) {
              edges { node { id price } }
            }
          }
        }
      }
    }
  `);
  const data = await response.json();
  const allProducts = data.data.products.edges.map((e) => ({
    id: e.node.id,
    title: e.node.title,
    image: e.node.featuredImage?.url ?? "",
    variantId: e.node.variants.edges[0]?.node.id ?? "",
    price: e.node.variants.edges[0]?.node.price ?? "0",
  }));

  if (params.id && params.id !== "new") {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    const bundle = await prisma.bundle.findFirst({
      where: { id: params.id, shopId: shop?.id },
    });
    return { bundle, allProducts };
  }

  return { bundle: null, allProducts };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) throw new Error("Shop not found");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_bundle") {
    const data = {
      name: String(formData.get("name")),
      status: String(formData.get("status")),
      discountType: String(formData.get("discountType")),
      discountValue: parseFloat(String(formData.get("discountValue"))) || 0,
      products: JSON.parse(String(formData.get("products") || "[]")),
      showOnProduct: formData.get("showOnProduct") === "true",
      showOnCart: formData.get("showOnCart") === "true",
      applyToAll: formData.get("applyToAll") === "true",
    };
    if (params.id && params.id !== "new") {
      await prisma.bundle.update({ where: { id: params.id }, data });
    } else {
      await prisma.bundle.create({ data: { ...data, shopId: shop.id } });
    }
    return redirect("/app/bundles");
  }

  return {};
};

export default function BundleFormPage() {
  const { bundle, allProducts } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [name, setName] = useState(bundle?.name ?? "");
  const [status, setStatus] = useState(bundle?.status ?? "DRAFT");
  const [discountType, setDiscountType] = useState(bundle?.discountType ?? "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(String(bundle?.discountValue ?? "10"));
  const [showOnProduct, setShowOnProduct] = useState(bundle?.showOnProduct ?? true);
  const [showOnCart, setShowOnCart] = useState(bundle?.showOnCart ?? true);
  const [applyToAll, setApplyToAll] = useState(bundle?.applyToAll ?? false);
  const [bundleProducts, setBundleProducts] = useState(bundle?.products ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isSaving = fetcher.state === "submitting";

  const filteredProducts = allProducts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !bundleProducts.find(bp => bp.id === p.id)
  );

  const addProduct = useCallback((product) => {
    setBundleProducts((prev) => [...prev, product]);
  }, []);

  const removeProduct = useCallback((productId) => {
    setBundleProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const handleSave = useCallback((saveStatus) => {
    fetcher.submit(
      {
        intent: "save_bundle",
        name,
        status: saveStatus,
        discountType,
        discountValue,
        products: JSON.stringify(bundleProducts),
        showOnProduct: String(showOnProduct),
        showOnCart: String(showOnCart),
        applyToAll: String(applyToAll),
      },
      { method: "post" }
    );
  }, [name, discountType, discountValue, bundleProducts, showOnProduct, showOnCart, applyToAll, fetcher]);

  return (
    <Page
      title={bundle ? `Edit: ${bundle.name}` : "Create bundle"}
      backAction={{ content: "Bundles", onAction: () => navigate("/app/bundles") }}
      primaryAction={{
        content: "Save & activate",
        loading: isSaving,
        onAction: () => handleSave("ACTIVE"),
      }}
      secondaryActions={[
        { content: "Save as draft", onAction: () => handleSave("DRAFT") },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Bundle details</Text>
                <Divider />
                <TextField
                  label="Bundle name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Starter Kit Bundle"
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Apply bundle to</Text>
                <Divider />
                <ChoiceList
                  title=""
                  titleHidden
                  choices={[
                    { label: "All products in store", value: "all" },
                    { label: "Specific products only", value: "specific" },
                  ]}
                  selected={[applyToAll ? "all" : "specific"]}
                  onChange={(val) => setApplyToAll(val[0] === "all")}
                />
              </BlockStack>
            </Card>

            {!applyToAll && (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">Bundle products</Text>
                    <Badge tone={bundleProducts.length >= 2 ? "success" : "attention"}>
                      {bundleProducts.length} / 2+ required
                    </Badge>
                  </InlineStack>
                  <Divider />

                  {bundleProducts.length > 0 && (
                    <ResourceList
                      resourceName={{ singular: "product", plural: "products" }}
                      items={bundleProducts}
                      renderItem={(product) => (
                        <ResourceItem
                          id={product.id}
                          media={
                            <Thumbnail
                              source={product.image || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
                              alt={product.title}
                              size="small"
                            />
                          }
                          shortcutActions={[{
                            content: "Remove",
                            destructive: true,
                            onAction: () => removeProduct(product.id),
                          }]}
                        >
                          <Text fontWeight="bold" as="p">{product.title}</Text>
                          <Text tone="subdued" as="p">${product.price}</Text>
                        </ResourceItem>
                      )}
                    />
                  )}

                  <Button onClick={() => setShowPicker(!showPicker)}>
                    {showPicker ? "Hide product list" : "+ Add products"}
                  </Button>

                  {showPicker && (
                    <Card>
                      <BlockStack gap="200">
                        <TextField
                          label="Filter products"
                          labelHidden
                          value={searchQuery}
                          onChange={setSearchQuery}
                          placeholder="Filter by name..."
                          autoComplete="off"
                        />
                        <div style={{ maxHeight: 300, overflowY: "auto" }}>
                          {filteredProducts.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => { addProduct(product); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "10px 12px", cursor: "pointer",
                                borderRadius: 8, border: "1px solid #e5e5e5",
                                background: "#fafafa", marginBottom: 8,
                              }}
                            >
                              {product.image && (
                                <img src={product.image} alt={product.title}
                                  style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
                              )}
                              <div>
                                <Text fontWeight="bold" variant="bodySm" as="p">{product.title}</Text>
                                <Text tone="subdued" variant="bodySm" as="p">${product.price}</Text>
                              </div>
                              <div style={{ marginLeft: "auto" }}>
                                <Badge tone="success">+ Add</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </BlockStack>
                    </Card>
                  )}

                  {bundleProducts.length === 0 && !showPicker && (
                    <Banner tone="info">Click "+ Add products" to select products for this bundle.</Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Bundle discount</Text>
                <Divider />
                <Select
                  label="Discount type"
                  options={[
                    { label: "Percentage off (%)", value: "PERCENTAGE" },
                    { label: "Fixed amount off ($)", value: "FIXED" },
                  ]}
                  value={discountType}
                  onChange={setDiscountType}
                />
                <TextField
                  label={discountType === "PERCENTAGE" ? "Discount %" : "Discount amount ($)"}
                  value={discountValue}
                  onChange={setDiscountValue}
                  type="number"
                  autoComplete="off"
                  suffix={discountType === "PERCENTAGE" ? "%" : "$"}
                  helpText="Applied when customer adds all bundle products to cart"
                />
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Status</Text>
                <Divider />
                <Select
                  label="" labelHidden
                  options={[
                    { label: "Draft", value: "DRAFT" },
                    { label: "Active", value: "ACTIVE" },
                    { label: "Paused", value: "PAUSED" },
                  ]}
                  value={status}
                  onChange={setStatus}
                />
                <Badge tone={status === "ACTIVE" ? "success" : status === "PAUSED" ? "warning" : "attention"}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </Badge>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Display settings</Text>
                <Divider />
                <Checkbox
                  label="Show on product page"
                  checked={showOnProduct}
                  onChange={setShowOnProduct}
                  helpText="App block in theme editor"
                />
                <Checkbox
                  label="Show on cart page"
                  checked={showOnCart}
                  onChange={setShowOnCart}
                  helpText="Widget injected into cart"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Summary</Text>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Applies to</Text>
                  <Text as="p" fontWeight="bold">{applyToAll ? "All products" : `${bundleProducts.length} products`}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Discount</Text>
                  <Text as="p" fontWeight="bold">{discountValue}{discountType === "PERCENTAGE" ? "%" : "$"} off</Text>
                </InlineStack>
                {(applyToAll || bundleProducts.length >= 2) && (
                  <Banner tone="success">Ready to save!</Banner>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
