import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  DataTable,
  Divider,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { analytics: [], totalRevenue: 0, totalImpressions: 0, totalAccepted: 0, overallCvr: "0.0" };

  const funnels = await prisma.funnel.findMany({
    where: { shopId: shop.id },
    include: { upsellEvents: true },
  });

  const analytics = funnels.map((funnel) => {
    const impressions = funnel.upsellEvents.filter((e) => e.eventType === "IMPRESSION").length;
    const accepted = funnel.upsellEvents.filter((e) => e.eventType === "ACCEPTED").length;
    const declined = funnel.upsellEvents.filter((e) => e.eventType === "DECLINED").length;
    const revenue = funnel.upsellEvents
      .filter((e) => e.eventType === "ACCEPTED")
      .reduce((sum, e) => sum + e.revenueAdded, 0);
    const cvr = impressions > 0 ? ((accepted / impressions) * 100).toFixed(1) : "0.0";
    return { id: funnel.id, name: funnel.name, status: funnel.status, impressions, accepted, declined, revenue, cvr };
  });

  const totalRevenue = analytics.reduce((s, a) => s + a.revenue, 0);
  const totalImpressions = analytics.reduce((s, a) => s + a.impressions, 0);
  const totalAccepted = analytics.reduce((s, a) => s + a.accepted, 0);
  const overallCvr = totalImpressions > 0 ? ((totalAccepted / totalImpressions) * 100).toFixed(1) : "0.0";

  return { analytics, totalRevenue, totalImpressions, totalAccepted, overallCvr };
};

function StatCard({ title, value }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">{title}</Text>
        <Text as="p" variant="heading2xl" fontWeight="bold">{value}</Text>
      </BlockStack>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { analytics, totalRevenue, totalImpressions, totalAccepted, overallCvr } = useLoaderData();

  const rows = analytics.map((a) => [
    a.name,
    <Badge tone={a.status === "ACTIVE" ? "success" : "attention"}>
      {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
    </Badge>,
    String(a.impressions),
    String(a.accepted),
    `${a.cvr}%`,
    `$${a.revenue.toFixed(2)}`,
  ]);

  return (
    <Page title="Analytics" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <StatCard title="Total revenue lifted" value={`$${totalRevenue.toFixed(2)}`} />
            <StatCard title="Overall CVR" value={`${overallCvr}%`} />
            <StatCard title="Total impressions" value={String(totalImpressions)} />
            <StatCard title="Total accepted" value={String(totalAccepted)} />
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Per-funnel breakdown</Text>
              <Divider />
              {rows.length === 0 ? (
                <Text as="p" tone="subdued">No funnel data yet. Create a funnel and start getting orders.</Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "numeric"]}
                  headings={["Funnel", "Status", "Impressions", "Accepted", "CVR", "Revenue"]}
                  rows={rows}
                  totals={["", "", String(totalImpressions), String(totalAccepted), `${overallCvr}%`, `$${totalRevenue.toFixed(2)}`]}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
