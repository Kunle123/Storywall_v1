import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

const SOURCE_TYPES = [
  "article",
  "report",
  "document",
  "video",
  "audio",
  "archive",
  "social_post",
  "dataset",
  "other",
] as const;

const RELIABILITY = ["high", "medium", "low", "unrated"] as const;

const VERIFICATION = ["verified", "partially_verified", "unreviewed", "contested", "rejected"] as const;

const EXTRACTION = ["manual", "ai_extracted", "imported"] as const;

/** POST …/events/:eventId/sources — mutation §15.1 (minimal manual attach). */
export class CreateSourceDto {
  @IsString()
  @MinLength(8)
  @MaxLength(8000)
  source_url!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  source_title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  publisher_name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  relevance_note!: string;

  @IsOptional()
  @IsDateString()
  published_at?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  excerpt?: string | null;

  @IsOptional()
  @IsIn(SOURCE_TYPES)
  source_type?: (typeof SOURCE_TYPES)[number];

  @IsOptional()
  @IsIn(RELIABILITY)
  reliability_tier?: (typeof RELIABILITY)[number];

  @IsOptional()
  @IsIn(VERIFICATION)
  verification_status?: (typeof VERIFICATION)[number];

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsIn(EXTRACTION)
  source_extraction_method?: (typeof EXTRACTION)[number];
}
