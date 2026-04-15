import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

/** Mutation §11.2 — request body for `POST …/draft/assemble`. M2-T12: scoped_event_regeneration / scoped_section_regeneration. */
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

  /** When mode is `scoped_event_regeneration`, targets one `event_draft` id. */
  @IsOptional()
  @IsUUID("4")
  scoped_event_id?: string;

  /** When mode is `scoped_section_regeneration`, targets one `section_draft` id. */
  @IsOptional()
  @IsUUID("4")
  scoped_section_id?: string;
}
