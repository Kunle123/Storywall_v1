import { IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

/**
 * PATCH …/sections/:sectionId — mutation §13.2; partial update.
 * Version token: `If-Match` = `updated_at` (ISO 8601).
 */
export class PatchSectionDto {
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  label?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100000)
  summary?: string | null;
}
