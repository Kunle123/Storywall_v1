import type { CreatorWorkflowState, Prisma } from "@prisma/client";

export async function failResearchJobInTx(
  tx: Prisma.TransactionClient,
  params: {
    researchJobId: string;
    storyId: string;
    wfDuring: CreatorWorkflowState;
    restoreWorkflowState: CreatorWorkflowState;
    errorMessage: string;
  },
): Promise<void> {
  await tx.researchJob.update({
    where: { id: params.researchJobId },
    data: {
      status: "failed",
      finishedAt: new Date(),
      errorMessage: params.errorMessage.slice(0, 8000),
    },
  });

  await tx.story.update({
    where: { id: params.storyId },
    data: { workflowState: params.restoreWorkflowState },
  });

  const after = await tx.story.findUniqueOrThrow({
    where: { id: params.storyId },
    select: { workflowState: true },
  });

  if (params.wfDuring !== after.workflowState) {
    await tx.storyWorkflowTransition.create({
      data: {
        storyId: params.storyId,
        fromWorkflowState: params.wfDuring,
        toWorkflowState: after.workflowState,
        actorType: "system",
        actorId: null,
        trigger: "research_job_failed",
      },
    });
  }
}
