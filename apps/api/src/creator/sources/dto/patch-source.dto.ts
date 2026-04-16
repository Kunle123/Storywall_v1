import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

const RELIABILITY = ["high", "medium", "low", "unrated"] as const;

const VERIFICATION = ["verified", "partially_verified", "unreviewed", "contested", "rejected"] as const;

const SOURCE_RECORD_STATUS = ["draft", "approved", "rejected"] as const;

/**
 * PATCH …/sources/:sourceId — mutation §15.2; partial update.
 * Version token: `If-Match` = `updated_at` (ISO 8601).
 */
export class PatchSourceDto {
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(8000)
  source_url?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  source_title?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  publisher_name?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  relevance_note?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  published_at?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100000)
  excerpt?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(RELIABILITY)
  reliability_tier?: (typeof RELIABILITY)[number];

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(VERIFICATION)
  verification_status?: (typeof VERIFICATION)[number];

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  is_primary?: boolean;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  is_public?: boolean;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(SOURCE_RECORD_STATUS)
  status?: (typeof SOURCE_RECORD_STATUS)[number];
}
