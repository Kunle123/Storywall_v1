import type { RevisionEntry } from "@prisma/client";

export function revisionEntryToApi(r: RevisionEntry): Record<string, unknown> {
  return {
    id: r.id,
    revision_type: r.revisionType,
    changed_object_type: r.changedObjectType,
    changed_object_id: r.changedObjectId,
    change_summary: r.changeSummary,
    is_material_public_change: r.isMaterialPublicChange,
    created_by: r.createdBy,
    created_at: r.createdAt.toISOString(),
    recovery_snapshot: r.recoverySnapshot,
  };
}
