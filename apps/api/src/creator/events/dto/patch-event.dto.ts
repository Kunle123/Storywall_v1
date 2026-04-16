import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

/**
 * PATCH …/events/:eventId — mutation §14.2; partial update (narrative slice).
 * Version token: `If-Match` = `updated_at` (ISO 8601).
 */
export class PatchEventDto {
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  headline?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  summary?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  dek?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100000)
  creator_note?: string | null;

  /** Human-readable timeline label for readers (e.g. “January 28, 1986 (EST)”). Empty string clears. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  display_date?: string;
}
