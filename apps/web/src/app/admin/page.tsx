import { AdminWorkspace } from "@/components/admin-workspace";

type AdminPageProps = {
  searchParams?: Promise<{
    targetType?: "SYSTEM" | "ROOM" | "ARTIFACT";
    targetId?: string;
    scope?: string;
    reviewerLabel?: string;
    brief?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <AdminWorkspace
      initialBrief={params.brief}
      initialReviewerLabel={params.reviewerLabel}
      initialScope={params.scope}
      initialTargetId={params.targetId}
      initialTargetType={params.targetType}
    />
  );
}
