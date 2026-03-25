import { redirect } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import {
  Page, Layout, Card, Text, Button, BlockStack, InlineStack,
  TextField, Select, Checkbox, Banner, Divider, Badge,
  Thumbnail, Modal, ResourceList, ResourceItem,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

const FUNCTION_ID = "019d1f64-2480-789e-9265-8465ad95930f";

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
  const { session, admin } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) throw new Error("Shop not found");

  const formData = await request.formData();
  const status = String(formData.get("status"));

  const data = {
    name: String(formData.get("name")),
    status,
    discountType: String(formData.get("discountType")),
    discountValue: parseFloat(String(formData.get("discountValue"))) || 0,
    products: JSON.parse(String(formData.get("products") || "[]")),
    displayProducts: JSON.parse(String(formData.get("displayProducts") || "[]")),
    showOnProduct: formData.get("showOnProduct") === "true",
    showOnCart: formData.get("showOnCart") === "true",
    applyToAll: false,
    displayOnAll: false,
  };

  // Create automatic discount function once per shop
  if (status === "ACTIVE") {
    try {
      const discountResult = await admin.graphql(
        `mutation CreateDiscount($functionId: String!, $startsAt: DateTime!) {
          discountAutomaticAppCreate(automaticAppDiscount: {
            title: "BrandsBro Bundle Discount"
            functionId: $functionId
            discountClasses: [PRODUCT]
            startsAt: $startsAt
          }) {
            automaticAppDiscount {
              discountId
            }
            userErrors { field message }
          }
        }`,
        { variables: { functionId: FUNCTION_ID, startsAt: new Date().toISOString() } }
      );
      const discountData = await discountResult.json();
      console.log("FULL RESPONSE:", JSON.stringify(discountData));
      const discountId = discountData?.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
      if (discountId) {
        await prisma.shop.update({ where: { shopDomain: session.shop }, data: { discountId } });
      }
    } catch (e) {
      console.error("Discount creation error:", e?.message, JSON.stringify(e?.graphQLErrors || e?.response || e));
    }
  }

  if (params.id && params.id !== "new") {
    await prisma.bundle.update({ where: { id: params.id }, data });
  } else {
    await prisma.bundle.create({ data: { ...data, shopId: shop.id } });
  }

  return redirect("/app/bundles");
};

function ProductPickerModal({ open, onClose, onConfirm, selected, onToggle, search, onSearch, title, confirmLabel, allProducts }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{ content: confirmLabel, onAction: onConfirm }}
      secondaryActions={[{ content: "Cancel", onAction: onClose }]}
    >
      <Modal.Section>
        <TextField
          label="Search" labelHidden
          value={search}
          onChange={onSearch}
          placeholder="Search products..."
          autoComplete="off"
          clearButton
          onClearButtonClick={() => onSearch("")}
        />
      </Modal.Section>
      <Modal.Section flush>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {allProducts
            .filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
            .map((product) => (
              <div
                key={product.id}
                onClick={() => onToggle(product.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 20px", cursor: "pointer",
                  background: selected.includes(product.id) ? "#f0f7f4" : "white",
                  borderBottom: "1px solid #e5e5e5",
                }}
              >
                <input type="checkbox" checked={selected.includes(product.id)}
                  onChange={() => onToggle(product.id)}
                  style={{ width: 18, height: 18, cursor: "pointer" }} />
                {product.image && (
                  <img src={product.image} alt={product.title}
                    style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e5e5" }} />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{product.title}</p>
                  <p style={{ margin: 0, color: "#666", fontSize: 13 }}>${product.price}</p>
                </div>
                {selected.includes(product.id) && (
                  <span style={{ color: "#008060", fontWeight: 600, fontSize: 13 }}>✓</span>
                )}
              </div>
            ))}
        </div>
      </Modal.Section>
    </Modal>
  );
}

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
  const [bundleProducts, setBundleProducts] = useState(bundle?.products ?? []);
  const [displayProducts, setDisplayProducts] = useState(bundle?.displayProducts ?? []);

  const [bundlePickerOpen, setBundlePickerOpen] = useState(false);
  const [bundlePickerSearch, setBundlePickerSearch] = useState("");
  const [selectedInBundlePicker, setSelectedInBundlePicker] = useState([]);

  const [displayPickerOpen, setDisplayPickerOpen] = useState(false);
  const [displayPickerSearch, setDisplayPickerSearch] = useState("");
  const [selectedInDisplayPicker, setSelectedInDisplayPicker] = useState([]);

  const isSaving = fetcher.state === "submitting";

  const handleOpenBundlePicker = useCallback(() => {
    setSelectedInBundlePicker(bundleProducts.map(p => p.id));
    setBundlePickerOpen(true);
    setBundlePickerSearch("");
  }, [bundleProducts]);

  const handleConfirmBundlePicker = useCallback(() => {
    setBundleProducts(allProducts.filter(p => selectedInBundlePicker.includes(p.id)));
    setBundlePickerOpen(false);
  }, [selectedInBundlePicker, allProducts]);

  const handleOpenDisplayPicker = useCallback(() => {
    setSelectedInDisplayPicker(displayProducts.map(p => p.id));
    setDisplayPickerOpen(true);
    setDisplayPickerSearch("");
  }, [displayProducts]);

  const handleConfirmDisplayPicker = useCallback(() => {
    setDisplayProducts(allProducts.filter(p => selectedInDisplayPicker.includes(p.id)));
    setDisplayPickerOpen(false);
  }, [selectedInDisplayPicker, allProducts]);

  const toggleBundleProduct = useCallback((id) => {
    setSelectedInBundlePicker(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const toggleDisplayProduct = useCallback((id) => {
    setSelectedInDisplayPicker(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleSave = useCallback((saveStatus) => {
    fetcher.submit(
      {
        name,
        status: saveStatus,
        discountType,
        discountValue,
        products: JSON.stringify(bundleProducts),
        displayProducts: JSON.stringify(displayProducts),
        showOnProduct: String(showOnProduct),
        showOnCart: String(showOnCart),
      },
      { method: "post" }
    );
  }, [name, discountType, discountValue, bundleProducts, displayProducts, showOnProduct, showOnCart, fetcher]);

  return (
    <Page
      title={bundle ? `Edit: ${bundle.name}` : "Create bundle"}
      backAction={{ content: "Bundles", onAction: () => navigate("/app/bundles") }}
      primaryAction={{
        content: "Save & activate",
        loading: isSaving,
        onAction: () => handleSave("ACTIVE"),
      }}
      secondaryActions={[{ content: "Save as draft", onAction: () => handleSave("DRAFT") }]}
    >
      <ProductPickerModal
        open={bundlePickerOpen}
        onClose={() => setBundlePickerOpen(false)}
        onConfirm={handleConfirmBundlePicker}
        selected={selectedInBundlePicker}
        onToggle={toggleBundleProduct}
        search={bundlePickerSearch}
        onSearch={setBundlePickerSearch}
        title="Select bundle products"
        confirmLabel={`Confirm ${selectedInBundlePicker.length} product${selectedInBundlePicker.length !== 1 ? "s" : ""}`}
        allProducts={allProducts}
      />

      <ProductPickerModal
        open={displayPickerOpen}
        onClose={() => setDisplayPickerOpen(false)}
        onConfirm={handleConfirmDisplayPicker}
        selected={selectedInDisplayPicker}
        onToggle={toggleDisplayProduct}
        search={displayPickerSearch}
        onSearch={setDisplayPickerSearch}
        title="Select trigger product pages"
        confirmLabel={`Confirm ${selectedInDisplayPicker.length} product${selectedInDisplayPicker.length !== 1 ? "s" : ""}`}
        allProducts={allProducts}
      />

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
                <Text as="h2" variant="headingMd">Bundle products</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Select the products that make up this bundle.
                </Text>
                <Divider />
                {bundleProducts.length > 0 && (
                  <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={bundleProducts}
                    renderItem={(product) => (
                      <ResourceItem
                        id={product.id}
                        media={<Thumbnail source={product.image || ""} alt={product.title} size="small" />}
                        shortcutActions={[{
                          content: "Remove", destructive: true,
                          onAction: () => setBundleProducts(prev => prev.filter(p => p.id !== product.id))
                        }]}
                      >
                        <Text fontWeight="bold" as="p">{product.title}</Text>
                        <Text tone="subdued" as="p">${product.price}</Text>
                      </ResourceItem>
                    )}
                  />
                )}
                <Button onClick={handleOpenBundlePicker}>
                  {bundleProducts.length > 0 ? "Edit bundle products" : "Select bundle products"}
                </Button>
                {bundleProducts.length === 0 && (
                  <Banner tone="info">Select 2 or more products for this bundle.</Banner>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Show bundle on</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Select which product page(s) will trigger this bundle widget.
                </Text>
                <Divider />
                {displayProducts.length > 0 && (
                  <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={displayProducts}
                    renderItem={(product) => (
                      <ResourceItem
                        id={product.id}
                        media={<Thumbnail source={product.image || ""} alt={product.title} size="small" />}
                        shortcutActions={[{
                          content: "Remove", destructive: true,
                          onAction: () => setDisplayProducts(prev => prev.filter(p => p.id !== product.id))
                        }]}
                      >
                        <Text fontWeight="bold" as="p">{product.title}</Text>
                        <Text tone="subdued" as="p">${product.price}</Text>
                      </ResourceItem>
                    )}
                  />
                )}
                <Button onClick={handleOpenDisplayPicker}>
                  {displayProducts.length > 0 ? "Edit trigger products" : "Select trigger products"}
                </Button>
                {displayProducts.length === 0 && (
                  <Banner tone="info">Select which product pages show this bundle widget.</Banner>
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
                  <Text as="p" tone="subdued">Bundle products</Text>
                  <Text as="p" fontWeight="bold">{bundleProducts.length} products</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Shows on</Text>
                  <Text as="p" fontWeight="bold">{displayProducts.length} pages</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Discount</Text>
                  <Text as="p" fontWeight="bold">{discountValue}{discountType === "PERCENTAGE" ? "%" : "$"} off</Text>
                </InlineStack>
                {bundleProducts.length >= 2 && displayProducts.length >= 1 && (
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
