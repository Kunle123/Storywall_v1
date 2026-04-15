import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/** Mutation §11.1 request body — research artifact persistence is M2-T02. */
export class RunResearchPassDto {
  @IsIn(["full"])
  mode!: "full";

  @IsBoolean()
  respect_existing_manual_events!: boolean;

  @IsBoolean()
  respect_existing_sources!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
