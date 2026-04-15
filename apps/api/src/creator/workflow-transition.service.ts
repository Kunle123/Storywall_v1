import { Injectable } from "@nestjs/common";
import {
  type CreatorWorkflowState,
  type Prisma,
  type WorkflowTransitionActorType,
} from "@prisma/client";

/** M1-T13: narrow persistence for setup-flow workflow changes — not a generic audit bus. */
@Injectable()
export class WorkflowTransitionService {
  /**
   * Records one append-only row when workflow state actually changes.
   * Skips when `from` equals `to` (including when both are non-null).
   */
  async appendIfChanged(
    tx: Prisma.TransactionClient,
    params: {
      storyId: string;
      fromState: CreatorWorkflowState | null;
      toState: CreatorWorkflowState;
      actorType: WorkflowTransitionActorType;
      actorId: string | null;
      trigger: string;
    },
  ): Promise<void> {
    const { storyId, fromState, toState, actorType, actorId, trigger } = params;
    if (fromState === toState) {
      return;
    }
    await tx.storyWorkflowTransition.create({
      data: {
        storyId,
        fromWorkflowState: fromState,
        toWorkflowState: toState,
        actorType,
        actorId,
        trigger,
      },
    });
  }
}
