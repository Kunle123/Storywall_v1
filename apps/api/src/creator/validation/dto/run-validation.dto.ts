import { IsBoolean, IsIn, IsOptional } from "class-validator";

/** Mutation §17.1 — request body for `POST …/validation/run`. */
export class RunValidationDto {
  @IsIn(["structure", "trust", "style", "publish_readiness", "full"])
  run_type!: string;

  @IsOptional()
  @IsBoolean()
  include_style_checks?: boolean;

  @IsOptional()
  @IsBoolean()
  include_imagery_checks?: boolean;

  @IsOptional()
  @IsBoolean()
  include_dispute_checks?: boolean;
}
