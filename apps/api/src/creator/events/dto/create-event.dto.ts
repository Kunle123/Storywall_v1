import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator";

/** POST …/events — mutation §14.1 (minimal manual create). */
export class CreateEventDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID("4")
  section_id?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  headline!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  summary!: string;
}
