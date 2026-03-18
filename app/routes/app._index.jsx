import { useLoaderData, useNavigate } from "react-router";

import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  EmptyState,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    include: {
      funnels: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { funnels: true, upsellEvents: true } },
    },
  });

  const revenueData = await prisma.upsellEvent.aggregate({
    where: { shopId: shop?.id, eventType: "ACCEPTED" },
    _sum: { revenueAdded: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [impressions, accepted, declined] = await Promise.all([
    prisma.upsellEvent.count({
      where: { shopId: shop?.id, eventType: "IMPRESSION", createdAt: { gte: monthStart } },
    }),
    prisma.upsellEvent.count({
      where: { shopId: shop?.id, eventType: "ACCEPTED", createdAt: { gte: monthStart } },
    }),
    prisma.upsellEvent.count({
      where: { shopId: shop?.id, eventType: "DECLINED", createdAt: { gte: monthStart } },
    }),
  ]);

  const conversionRate =
    impressions > 0 ? ((accepted / impressions) * 100).toFixed(1) : "0.0";

  return {
    shop,
    stats: {
      totalFunnels: shop?._count.funnels ?? 0,
      revenueLifted: revenueData._sum.revenueAdded ?? 0,
      impressions,
      accepted,
      declined,
      conversionRate,
      activeFunnels: shop?.funnels.filter((f) => f.status === "ACTIVE").length ?? 0,
    },
  };
};

function StatCard({ title, value, subtitle, tone }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">{title}</Text>
        <Text as="p" variant="heading2xl" tone={tone} fontWeight="bold">{value}</Text>
        <Text as="p" variant="bodySm" tone="subdued">{subtitle}</Text>
      </BlockStack>
    </Card>
  );
}

export default function Index() {
  const { shop, stats } = useLoaderData();
  const navigate = useNavigate();
  const recentFunnels = shop?.funnels ?? [];

  const funnelRows = recentFunnels.map((funnel) => [
    funnel.name,
    <Badge
      tone={
        funnel.status === "ACTIVE" ? "success" :
        funnel.status === "DRAFT" ? "attention" : "critical"
      }
    >
      {funnel.status.charAt(0) + funnel.status.slice(1).toLowerCase()}
    </Badge>,
    funnel.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()),
    `${funnel.discountValue}${funnel.discountType === "PERCENTAGE" ? "%" : " off"}`,
    new Date(funnel.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page
      title="Upsell Dashboard"
      primaryAction={{
        content: "Create funnel",
        onAction: () => navigate("/app/funnels/new"),
      }}
    >
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <StatCard title="Revenue lifted" value={`$${Number(stats.revenueLifted).toFixed(2)}`} subtitle="All time" tone="success" />
            <StatCard title="Conversion rate" value={`${stats.conversionRate}%`} subtitle="This month" tone="info" />
            <StatCard title="Impressions" value={String(stats.impressions)} subtitle="This month" />
            <StatCard title="Active funnels" value={String(stats.activeFunnels)} subtitle={`of ${stats.totalFunnels} total`} />
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Recent funnels</Text>
                <Button variant="plain" onAction={() => navigate("/app/funnels")}>View all</Button>
              </InlineStack>
              {recentFunnels.length === 0 ? (
                <EmptyState
                  heading="No funnels yet"
                  action={{
                    content: "Create your first funnel",
                    onAction: () => navigate("/app/funnels/new"),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Create upsell funnels to show offers after checkout or on the cart page.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={["Name", "Status", "Type", "Discount", "Created"]}
                  rows={funnelRows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick actions</Text>
                <Divider />
                <Button fullWidth onAction={() => navigate("/app/funnels/new")} variant="primary">
                  + New post-purchase funnel
                </Button>
                <Button fullWidth onAction={() => navigate("/app/funnels/new?type=PRE_PURCHASE_CART")}>
                  + New cart page upsell
                </Button>
                <Button fullWidth onAction={() => navigate("/app/analytics")} variant="plain">
                  View analytics →
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">This month</Text>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Accepted</Text>
                  <Text as="p" fontWeight="bold">{stats.accepted}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Declined</Text>
                  <Text as="p">{stats.declined}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">Impressions</Text>
                  <Text as="p">{stats.impressions}</Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
