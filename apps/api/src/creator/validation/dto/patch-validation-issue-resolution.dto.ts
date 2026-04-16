import { IsIn } from "class-validator";

/** M3-T05 — PATCH …/validation/issues/:issueId (creator resolution only). */
export class PatchValidationIssueResolutionDto {
  @IsIn(["open", "resolved"])
  resolution_status!: "open" | "resolved";
}
