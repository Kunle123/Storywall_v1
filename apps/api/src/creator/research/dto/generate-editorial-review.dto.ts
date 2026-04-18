import { IsOptional, IsString, MaxLength } from "class-validator";

/** POST …/research/jobs/:jobId/editorial-review/generate — M5-T12. */
export class GenerateEditorialReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
