import { IsOptional, IsString, MaxLength } from "class-validator";

/** POST …/research/jobs/:jobId/live-event-draft-enrichment/generate — M5-T11. */
export class GenerateLiveEnrichmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
