import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * POST /api/v1/creator/stories/:storyId/frames/generate — mutation contract §10.1.
 */
export class GenerateFramesDto {
  @IsOptional()
  @IsBoolean()
  replace_existing_unselected_frames?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
