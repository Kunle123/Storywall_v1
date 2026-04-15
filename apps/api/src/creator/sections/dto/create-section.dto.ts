import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** POST …/sections — mutation §13.1. */
export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  summary?: string;
}
