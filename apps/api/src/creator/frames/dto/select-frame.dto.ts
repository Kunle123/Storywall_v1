import { IsIn, IsUUID } from "class-validator";

/** POST /api/v1/creator/stories/:storyId/frames/select — mutation contract §10.2 */
export class SelectFrameDto {
  @IsUUID("4")
  frame_id!: string;

  @IsIn(["accept"])
  selection_mode!: "accept";
}
