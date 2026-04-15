import { IsBoolean, IsString, MaxLength, MinLength } from "class-validator";

/** Mutation §11.2 — request body for `POST …/draft/assemble`. */
export class AssembleDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  mode!: string;

  @IsBoolean()
  preserve_creator_notes!: boolean;

  @IsBoolean()
  preserve_manual_event_positions!: boolean;

  @IsBoolean()
  preserve_approved_images!: boolean;
}
