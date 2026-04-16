import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  BRIEF_AUDIENCE,
  BRIEF_IMAGERY_MODE,
  BRIEF_STORY_TYPE,
  CREATION_MODE,
  NARRATIVE_INTENT,
  SUBJECT_TYPE,
  TIME_SCOPE_MODE,
  WRITING_STYLE,
} from "../brief-enums";

/**
 * PATCH body — mutation §9.2; partial update.
 * - Omit a field → no change.
 * - Send `null` on nullable brief fields → explicit clear (see M1-T08 revision).
 * - Required brief columns must not be cleared with `null` (rejected in service).
 */
export class PatchStoryBriefDto {
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  subject?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(SUBJECT_TYPE)
  subject_type_input?: (typeof SUBJECT_TYPE)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(BRIEF_STORY_TYPE)
  story_type?: (typeof BRIEF_STORY_TYPE)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  research_brief?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  desired_angle?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(10000)
  suggested_time_scope?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(TIME_SCOPE_MODE)
  time_scope_mode?: (typeof TIME_SCOPE_MODE)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  time_scope_start?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  time_scope_end?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(BRIEF_AUDIENCE)
  audience?: (typeof BRIEF_AUDIENCE)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(NARRATIVE_INTENT)
  narrative_intent?: (typeof NARRATIVE_INTENT)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(BRIEF_IMAGERY_MODE)
  imagery_mode?: (typeof BRIEF_IMAGERY_MODE)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsArray()
  @Type(() => Object)
  source_inputs?: unknown[] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(WRITING_STYLE)
  writing_style_preference?: (typeof WRITING_STYLE)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(CREATION_MODE)
  creation_mode?: (typeof CREATION_MODE)[number] | null;
}
