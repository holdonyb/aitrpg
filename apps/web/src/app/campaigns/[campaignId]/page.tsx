import { CampaignWorkspace } from "@/components/campaign-workspace";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return <CampaignWorkspace campaignId={campaignId} />;
}

