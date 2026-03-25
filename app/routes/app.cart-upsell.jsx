import { useLoaderData, useFetcher } from "react-router";
import {
  Page, Layout, Card, Text, BlockStack, Button,
  Divider, Banner, Thumbnail, ResourceList, ResourceItem,
  Modal, TextField, InlineStack, Badge,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }) => {
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

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  return {
    allProducts,
    cartUpsellProducts: shop?.cartUpsellProducts ?? [],
    cartUpsellActive: shop?.cartUpsellActive ?? false,
  };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });

  if (intent === "save_products") {
    const products = JSON.parse(String(formData.get("products") || "[]"));
    await prisma.shop.update({
      where: { shopDomain: session.shop },
      data: { cartUpsellProducts: products },
    });
    return { success: true };
  }

  if (intent === "toggle_active") {
    const active = formData.get("active") === "true";

    if (active) {
      // Create ScriptTag to inject cart upsell on all pages
      const scriptUrl = "https://brandsbro-upsell.onrender.com/cart-upsell-script";
      const result = await admin.graphql(`
        mutation {
          scriptTagCreate(input: {
            src: "${scriptUrl}"
            displayScope: ONLINE_STORE
          }) {
            scriptTag { id src }
            userErrors { field message }
          }
        }
      `);
      const resultData = await result.json();
      const scriptTagId = resultData?.data?.scriptTagCreate?.scriptTag?.id;
      await prisma.shop.update({
        where: { shopDomain: session.shop },
        data: { cartUpsellActive: true, cartUpsellScriptTagId: scriptTagId ?? null },
      });
    } else {
      // Delete ScriptTag
      if (shop?.cartUpsellScriptTagId) {
        await admin.graphql(`
          mutation {
            scriptTagDelete(id: "${shop.cartUpsellScriptTagId}") {
              deletedScriptTagId
              userErrors { field message }
            }
          }
        `);
      }
      await prisma.shop.update({
        where: { shopDomain: session.shop },
        data: { cartUpsellActive: false, cartUpsellScriptTagId: null },
      });
    }
    return { success: true, active };
  }

  return {};
};

export default function CartUpsellPage() {
  const { allProducts, cartUpsellProducts, cartUpsellActive } = useLoaderData();
  const fetcher = useFetcher();

  const [selectedProducts, setSelectedProducts] = useState(cartUpsellProducts);
  const [active, setActive] = useState(cartUpsellActive);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedInPicker, setSelectedInPicker] = useState([]);

  const isSaving = fetcher.state === "submitting";

  const handleToggle = useCallback(() => {
    const newActive = !active;
    setActive(newActive);
    fetcher.submit(
      { intent: "toggle_active", active: String(newActive) },
      { method: "post" }
    );
  }, [active, fetcher]);

  const handleOpenPicker = useCallback(() => {
    setSelectedInPicker(selectedProducts.map(p => p.id));
    setPickerOpen(true);
    setSearch("");
  }, [selectedProducts]);

  const handleConfirm = useCallback(() => {
    const confirmed = allProducts.filter(p => selectedInPicker.includes(p.id)).slice(0, 5);
    setSelectedProducts(confirmed);
    setPickerOpen(false);
    fetcher.submit(
      { intent: "save_products", products: JSON.stringify(confirmed) },
      { method: "post" }
    );
  }, [selectedInPicker, allProducts, fetcher]);

  const toggle = useCallback((id) => {
    setSelectedInPicker(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  }, []);

  return (
    <Page
      title="Cart Drawer Upsell"
      subtitle="Show upsell products inside the cart drawer on all pages"
    >
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select products (max 5)"
        primaryAction={{
          content: `Confirm ${selectedInPicker.length} product${selectedInPicker.length !== 1 ? "s" : ""}`,
          onAction: handleConfirm,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setPickerOpen(false) }]}
      >
        <Modal.Section>
          <TextField
            label="Search" labelHidden
            value={search}
            onChange={setSearch}
            placeholder="Search products..."
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch("")}
          />
        </Modal.Section>
        <Modal.Section flush>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {allProducts
              .filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
              .map((product) => (
                <div
                  key={product.id}
                  onClick={() => toggle(product.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 20px", cursor: "pointer",
                    background: selectedInPicker.includes(product.id) ? "#f0f7f4" : "white",
                    borderBottom: "1px solid #e5e5e5",
                    opacity: !selectedInPicker.includes(product.id) && selectedInPicker.length >= 5 ? 0.4 : 1,
                  }}
                >
                  <input type="checkbox"
                    checked={selectedInPicker.includes(product.id)}
                    onChange={() => toggle(product.id)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                    disabled={!selectedInPicker.includes(product.id) && selectedInPicker.length >= 5}
                  />
                  {product.image && (
                    <img src={product.image} alt={product.title}
                      style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e5e5" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{product.title}</p>
                    <p style={{ margin: 0, color: "#666", fontSize: 13 }}>${product.price}</p>
                  </div>
                  {selectedInPicker.includes(product.id) && (
                    <span style={{ color: "#008060", fontWeight: 600, fontSize: 13 }}>✓</span>
                  )}
                </div>
              ))}
          </div>
        </Modal.Section>
      </Modal>

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">Cart Upsell Widget</Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Automatically shows upsell products in cart drawer on all pages
                    </Text>
                  </BlockStack>
                  <Button
                    variant={active ? "secondary" : "primary"}
                    tone={active ? "critical" : undefined}
                    loading={isSaving}
                    onClick={handleToggle}
                  >
                    {active ? "Deactivate" : "Activate"}
                  </Button>
                </InlineStack>
                <Divider />
                <InlineStack gap="200">
                  <Badge tone={active ? "success" : "attention"}>
                    {active ? "Active" : "Inactive"}
                  </Badge>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {active ? "Widget is live on your store" : "Widget is not showing on your store"}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Upsell products</Text>
                  <Badge tone={selectedProducts.length > 0 ? "success" : "attention"}>
                    {selectedProducts.length} / 5 selected
                  </Badge>
                </InlineStack>
                <Divider />

                {selectedProducts.length > 0 && (
                  <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={selectedProducts}
                    renderItem={(product) => (
                      <ResourceItem
                        id={product.id}
                        media={<Thumbnail source={product.image || ""} alt={product.title} size="small" />}
                        shortcutActions={[{
                          content: "Remove", destructive: true,
                          onAction: () => {
                            const updated = selectedProducts.filter(p => p.id !== product.id);
                            setSelectedProducts(updated);
                            fetcher.submit(
                              { intent: "save_products", products: JSON.stringify(updated) },
                              { method: "post" }
                            );
                          }
                        }]}
                      >
                        <Text fontWeight="bold" as="p">{product.title}</Text>
                        <Text tone="subdued" as="p">${product.price}</Text>
                      </ResourceItem>
                    )}
                  />
                )}

                <Button onClick={handleOpenPicker}>
                  {selectedProducts.length > 0 ? "Edit upsell products" : "Select upsell products"}
                </Button>

                {selectedProducts.length === 0 && (
                  <Banner tone="info">
                    Select up to 5 products to show as upsells in the cart drawer.
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">How it works</Text>
              <Divider />
              <Text as="p" tone="subdued">1. Select up to 5 products</Text>
              <Text as="p" tone="subdued">2. Click Activate</Text>
              <Text as="p" tone="subdued">3. Widget automatically appears in cart drawer on all pages</Text>
              <Text as="p" tone="subdued">4. No theme changes needed</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
