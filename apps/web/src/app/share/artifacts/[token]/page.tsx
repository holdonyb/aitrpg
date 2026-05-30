import { SharedArtifactView } from "@/components/shared-artifact-view";

export default async function SharedArtifactPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedArtifactView token={token} />;
}
