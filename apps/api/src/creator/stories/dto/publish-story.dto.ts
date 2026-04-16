import { IsBoolean, IsOptional } from "class-validator";

/** M3-T07 — POST …/publish */
export class PublishStoryDto {
  /** Required when latest validation `overall_result` is `warn`. */
  @IsOptional()
  @IsBoolean()
  acknowledge_validation_warnings?: boolean;
}
