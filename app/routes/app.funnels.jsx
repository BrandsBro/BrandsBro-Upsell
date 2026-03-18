import { useLoaderData, useNavigate } from "react-router";

import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Badge,
  IndexTable,
  EmptyState,
  Filters,
  useIndexResourceState,
  ChoiceList,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { funnels: [] };

  const funnels = await prisma.funnel.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { upsellEvents: true } } },
  });

  return { funnels };
};

export default function FunnelsPage() {
  const { funnels } = useLoaderData();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState([]);
  const [queryValue, setQueryValue] = useState("");

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(funnels);

  const handleClearAll = useCallback(() => {
    setStatusFilter([]);
    setQueryValue("");
  }, []);

  const filteredFunnels = funnels.filter((f) => {
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(f.status);
    const matchesQuery = queryValue === "" || f.name.toLowerCase().includes(queryValue.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const rowMarkup = filteredFunnels.map((funnel, index) => (
    <IndexTable.Row
      id={funnel.id}
      key={funnel.id}
      selected={selectedResources.includes(funnel.id)}
      position={index}
      onClick={() => navigate(`/app/funnels/${funnel.id}`)}
    >
      <IndexTable.Cell>
        <Text fontWeight="bold" as="span">{funnel.name}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={
          funnel.status === "ACTIVE" ? "success" :
          funnel.status === "DRAFT" ? "attention" :
          funnel.status === "PAUSED" ? "warning" : "critical"
        }>
          {funnel.status.charAt(0) + funnel.status.slice(1).toLowerCase()}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {funnel.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {funnel.discountValue > 0
          ? `${funnel.discountValue}${funnel.discountType === "PERCENTAGE" ? "%" : funnel.discountType === "FIXED" ? " fixed" : " free ship"}`
          : "No discount"}
      </IndexTable.Cell>
      <IndexTable.Cell>{funnel._count.upsellEvents}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={funnel.abTestEnabled ? "info" : undefined}>
          {funnel.abTestEnabled ? "A/B on" : "Off"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(funnel.createdAt).toLocaleDateString()}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Funnels"
      primaryAction={{
        content: "Create funnel",
        onAction: () => navigate("/app/funnels/new"),
      }}
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {funnels.length === 0 ? (
              <EmptyState
                heading="Create your first upsell funnel"
                action={{
                  content: "Create funnel",
                  onAction: () => navigate("/app/funnels/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Funnels show upsell offers to customers after checkout or on the cart page.</p>
              </EmptyState>
            ) : (
              <>
                <div style={{ padding: "16px 16px 0" }}>
                  <Filters
                    queryValue={queryValue}
                    queryPlaceholder="Search funnels"
                    filters={[
                      {
                        key: "status",
                        label: "Status",
                        filter: (
                          <ChoiceList
                            title="Status"
                            titleHidden
                            choices={[
                              { label: "Active", value: "ACTIVE" },
                              { label: "Draft", value: "DRAFT" },
                              { label: "Paused", value: "PAUSED" },
                              { label: "Archived", value: "ARCHIVED" },
                            ]}
                            selected={statusFilter}
                            onChange={setStatusFilter}
                            allowMultiple
                          />
                        ),
                        shortcut: true,
                      },
                    ]}
                    appliedFilters={
                      statusFilter.length > 0
                        ? [{ key: "status", label: `Status: ${statusFilter.join(", ")}`, onRemove: () => setStatusFilter([]) }]
                        : []
                    }
                    onQueryChange={setQueryValue}
                    onQueryClear={() => setQueryValue("")}
                    onClearAll={handleClearAll}
                  />
                </div>
                <IndexTable
                  resourceName={{ singular: "funnel", plural: "funnels" }}
                  itemCount={filteredFunnels.length}
                  selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Name" },
                    { title: "Status" },
                    { title: "Type" },
                    { title: "Discount" },
                    { title: "Events" },
                    { title: "A/B test" },
                    { title: "Created" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
