import { redirect } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import {
  Page, Layout, Card, Text, Button, BlockStack, InlineStack,
  TextField, Select, Checkbox, Banner, Divider, Badge,
  Thumbnail, ResourceList, ResourceItem,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  if (params.id && params.id !== "new") {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    const bundle = await prisma.bundle.findFirst({
      where: { id: params.id, shopId: shop?.id },
    });
    return { bundle };
  }
  return { bundle: null };
};

export const action = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) throw new Error("Shop not found");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "search_products") {
    const query = String(formData.get("query") || "");
    const response = await admin.graphql(`
      query searchProducts($query: String!) {
        products(first: 10, query: $query) {
          edges {
            node {
              id
              title
              featuredImage { url }
              variants(first: 1) {
                edges {
                  node { id price }
                }
              }
            }
          }
        }
      }
    `, { variables: { query } });
    const data = await response.json();
    const products = data.data.products.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      image: e.node.featuredImage?.url ?? "",
      variantId: e.node.variants.edges[0]?.node.id ?? "",
      price: e.node.variants.edges[0]?.node.price ?? "0",
    }));
    return { searchResults: products };
  }

  if (intent === "save_bundle") {
    const data = {
      name: String(formData.get("name")),
      status: String(formData.get("status")),
      discountType: String(formData.get("discountType")),
      discountValue: parseFloat(String(formData.get("discountValue"))) || 0,
      products: JSON.parse(String(formData.get("products") || "[]")),
      showOnProduct: formData.get("showOnProduct") === "true",
      showOnCart: formData.get("showOnCart") === "true",
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
  const { bundle } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [name, setName] = useState(bundle?.name ?? "");
  const [status, setStatus] = useState(bundle?.status ?? "DRAFT");
  const [discountType, setDiscountType] = useState(bundle?.discountType ?? "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(String(bundle?.discountValue ?? "10"));
  const [showOnProduct, setShowOnProduct] = useState(bundle?.showOnProduct ?? true);
  const [showOnCart, setShowOnCart] = useState(bundle?.showOnCart ?? true);
  const [bundleProducts, setBundleProducts] = useState(bundle?.products ?? []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const isSearching = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "search_products";
  const isSaving = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "save_bundle";

  useEffect(() => {
    if (fetcher.data?.searchResults) {
      setSearchResults(fetcher.data.searchResults);
    }
  }, [fetcher.data]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    fetcher.submit({ intent: "search_products", query: searchQuery }, { method: "post" });
  }, [searchQuery, fetcher]);

  const addProduct = useCallback((product) => {
    if (bundleProducts.find((p) => p.id === product.id)) return;
    setBundleProducts((prev) => [...prev, product]);
    setSearchResults([]);
    setSearchQuery("");
  }, [bundleProducts]);

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
      },
      { method: "post" }
    );
  }, [name, discountType, discountValue, bundleProducts, showOnProduct, showOnCart, fetcher]);

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
                <InlineStack gap="200">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Search products"
                      labelHidden
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Type product name and click Search..."
                      autoComplete="off"
                    />
                  </div>
                  <Button onClick={handleSearch} loading={isSearching}>Search</Button>
                </InlineStack>
                {searchResults.length > 0 && (
                  <Card>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodySm" tone="subdued">Click a product to add it</Text>
                      {searchResults.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => addProduct(product)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 12px", cursor: "pointer",
                            borderRadius: 8, border: "1px solid #e5e5e5", background: "#fafafa",
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
                    </BlockStack>
                  </Card>
                )}
                {bundleProducts.length === 0 && (
                  <Banner tone="info">Search for products above and add at least 2 to create a bundle.</Banner>
                )}
              </BlockStack>
            </Card>

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
                  <Text as="p" tone="subdued">Products</Text>
                  <Text as="p" fontWeight="bold">{bundleProducts.length}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Discount</Text>
                  <Text as="p" fontWeight="bold">{discountValue}{discountType === "PERCENTAGE" ? "%" : "$"} off</Text>
                </InlineStack>
                {bundleProducts.length >= 2 && (
                  <Banner tone="success">Ready to save! Hit "Save & activate" above.</Banner>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
