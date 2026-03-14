import { redirect } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Checkbox,
  Banner,
  Divider,
  Badge,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const defaultType = url.searchParams.get("type") ?? "POST_PURCHASE";

  if (params.id && params.id !== "new") {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    const funnel = await prisma.funnel.findFirst({
      where: { id: params.id, shopId: shop?.id },
    });
    return { funnel, defaultType };
  }

  return { funnel: null, defaultType };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) throw new Error("Shop not found");

  const formData = await request.formData();

  const data = {
    name: String(formData.get("name")),
    type: String(formData.get("type")),
    status: String(formData.get("status")),
    offerProductId: String(formData.get("offerProductId")),
    offerVariantId: String(formData.get("offerVariantId")),
    discountType: String(formData.get("discountType")),
    discountValue: parseFloat(String(formData.get("discountValue"))) || 0,
    abTestEnabled: formData.get("abTestEnabled") === "true",
    triggerRules: JSON.parse(String(formData.get("triggerRules") || "{}")),
  };

  if (params.id && params.id !== "new") {
    await prisma.funnel.update({ where: { id: params.id }, data });
  } else {
    await prisma.funnel.create({ data: { ...data, shopId: shop.id } });
  }

  return redirect("/app/funnels");
};

export default function FunnelFormPage() {
  const { funnel, defaultType } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [name, setName] = useState(funnel?.name ?? "");
  const [type, setType] = useState(funnel?.type ?? defaultType);
  const [status, setStatus] = useState(funnel?.status ?? "DRAFT");
  const [offerProductId, setOfferProductId] = useState(funnel?.offerProductId ?? "");
  const [offerVariantId, setOfferVariantId] = useState(funnel?.offerVariantId ?? "");
  const [discountType, setDiscountType] = useState(funnel?.discountType ?? "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(String(funnel?.discountValue ?? "10"));
  const [abTestEnabled, setAbTestEnabled] = useState(funnel?.abTestEnabled ?? false);
  const [minCartValue, setMinCartValue] = useState(funnel?.triggerRules?.minCartValue ?? "");
  const [requiredTag, setRequiredTag] = useState(funnel?.triggerRules?.requiredTag ?? "");

  const handleSave = useCallback((saveStatus) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("type", type);
    formData.append("status", saveStatus);
    formData.append("offerProductId", offerProductId);
    formData.append("offerVariantId", offerVariantId);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("abTestEnabled", String(abTestEnabled));
    formData.append("triggerRules", JSON.stringify({ minCartValue, requiredTag }));
    submit(formData, { method: "post" });
  }, [name, type, offerProductId, offerVariantId, discountType, discountValue, abTestEnabled, minCartValue, requiredTag, submit]);

  return (
    <Page
      title={funnel ? `Edit: ${funnel.name}` : "Create funnel"}
      backAction={{ content: "Funnels", url: "/app/funnels" }}
      primaryAction={{
        content: "Save & activate",
        loading: isLoading,
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
                <Text as="h2" variant="headingMd">Funnel details</Text>
                <Divider />
                <TextField
                  label="Funnel name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Post-purchase protein powder upsell"
                  autoComplete="off"
                />
                <Select
                  label="Funnel type"
                  options={[
                    { label: "Post-purchase (thank you page)", value: "POST_PURCHASE" },
                    { label: "Pre-purchase (cart page)", value: "PRE_PURCHASE_CART" },
                    { label: "Pre-purchase (product page)", value: "PRE_PURCHASE_PRODUCT" },
                  ]}
                  value={type}
                  onChange={setType}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Offer product</Text>
                <Divider />
                <Banner tone="info">
                  Enter your Shopify product and variant GIDs. Format: gid://shopify/Product/123456789
                </Banner>
                <TextField
                  label="Product GID"
                  value={offerProductId}
                  onChange={setOfferProductId}
                  placeholder="gid://shopify/Product/..."
                  autoComplete="off"
                />
                <TextField
                  label="Variant GID"
                  value={offerVariantId}
                  onChange={setOfferVariantId}
                  placeholder="gid://shopify/ProductVariant/..."
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Discount</Text>
                <Divider />
                <Select
                  label="Discount type"
                  options={[
                    { label: "Percentage off (%)", value: "PERCENTAGE" },
                    { label: "Fixed amount off ($)", value: "FIXED" },
                    { label: "Free shipping", value: "FREE_SHIPPING" },
                  ]}
                  value={discountType}
                  onChange={setDiscountType}
                />
                {discountType !== "FREE_SHIPPING" && (
                  <TextField
                    label={discountType === "PERCENTAGE" ? "Discount %" : "Discount amount ($)"}
                    value={discountValue}
                    onChange={setDiscountValue}
                    type="number"
                    autoComplete="off"
                    suffix={discountType === "PERCENTAGE" ? "%" : "$"}
                  />
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Trigger rules</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Only show this funnel when these conditions are met. Leave blank to show to everyone.
                </Text>
                <Divider />
                <TextField
                  label="Minimum cart value ($)"
                  value={minCartValue}
                  onChange={setMinCartValue}
                  type="number"
                  placeholder="e.g. 50"
                  autoComplete="off"
                  helpText="Only trigger if order value is above this amount"
                />
                <TextField
                  label="Required customer tag"
                  value={requiredTag}
                  onChange={setRequiredTag}
                  placeholder="e.g. vip, wholesale"
                  autoComplete="off"
                  helpText="Only show to customers with this tag"
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
                  label=""
                  labelHidden
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
                <Text as="h2" variant="headingMd">A/B testing</Text>
                <Divider />
                <Checkbox
                  label="Enable A/B test for this funnel"
                  checked={abTestEnabled}
                  onChange={setAbTestEnabled}
                  helpText="Split traffic 50/50 between two offer variants"
                />
                {abTestEnabled && (
                  <Banner tone="info">A/B variant config will be available after saving.</Banner>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Priority</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  If multiple funnels match a customer's order, the highest priority funnel is shown first.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
