export function normalizeReviewRun<
  T extends {
    targetId?: string | null;
    summary?: string | null;
    completedAt?: Date | null;
    linkedReviewReportId?: string | null;
    targetLabel?: string | null;
    targetRoomId?: string | null;
  },
>(run: T) {
  return {
    ...run,
    targetId: run.targetId ?? null,
    summary: run.summary ?? null,
    completedAt: run.completedAt ?? null,
    linkedReviewReportId: run.linkedReviewReportId ?? null,
    targetLabel: run.targetLabel ?? null,
    targetRoomId: run.targetRoomId ?? null,
  };
}
