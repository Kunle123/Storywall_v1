import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  DISCOVERY_MODE,
  EDITORIAL_REVIEW_STATUS,
  STORY_VISIBILITY,
} from "../draft-enums";

/**
 * PATCH body — mutation §12.1; partial update on `story_draft`.
 * Version token: `If-Match` = `last_edited_at` (ISO 8601).
 */
export class PatchStoryDraftDto {
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  subtitle?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  summary?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  lens?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100_000)
  conclusion?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  category_primary?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200)
  category_secondary?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  lead_priority?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(DISCOVERY_MODE)
  discovery_mode?: (typeof DISCOVERY_MODE)[number] | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  time_start?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  time_end?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  time_display?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(STORY_VISIBILITY)
  visibility_target?: (typeof STORY_VISIBILITY)[number];

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  needs_human_review?: boolean;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(EDITORIAL_REVIEW_STATUS)
  editorial_review_status?: (typeof EDITORIAL_REVIEW_STATUS)[number];
}
