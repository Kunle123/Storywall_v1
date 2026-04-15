import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
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
 * POST /api/v1/creator/stories — mutation contract §9.1 + editor §7.1.
 * JSON uses snake_case per contract examples.
 */
export class CreateStoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  subject!: string;

  @IsOptional()
  @IsIn(SUBJECT_TYPE)
  subject_type_input?: (typeof SUBJECT_TYPE)[number];

  @IsIn(BRIEF_STORY_TYPE)
  story_type!: (typeof BRIEF_STORY_TYPE)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  research_brief!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  desired_angle!: string;

  @IsIn(TIME_SCOPE_MODE)
  time_scope_mode!: (typeof TIME_SCOPE_MODE)[number];

  @IsOptional()
  @IsDateString()
  time_scope_start?: string;

  @IsOptional()
  @IsDateString()
  time_scope_end?: string;

  @IsOptional()
  @IsIn(BRIEF_AUDIENCE)
  audience?: (typeof BRIEF_AUDIENCE)[number];

  @IsIn(NARRATIVE_INTENT)
  narrative_intent!: (typeof NARRATIVE_INTENT)[number];

  @IsIn(BRIEF_IMAGERY_MODE)
  imagery_mode!: (typeof BRIEF_IMAGERY_MODE)[number];

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  source_inputs?: unknown[];

  @IsOptional()
  @IsIn(WRITING_STYLE)
  writing_style_preference?: (typeof WRITING_STYLE)[number];

  @IsIn(CREATION_MODE)
  creation_mode!: (typeof CREATION_MODE)[number];
}
