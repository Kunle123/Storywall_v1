import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../auth/types";

/**
 * Authenticated creator namespace (`/api/v1/creator/*`).
 * M1-T06: `me` only; story mutations arrive in M1-T07+.
 */
@Controller("api/v1/creator")
@UseGuards(AuthGuard("jwt"))
export class CreatorController {
  @Get("me")
  me(@CurrentCreator() creator: AuthenticatedCreator) {
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        creator: {
          id: creator.id,
          email: creator.email,
          display_name: creator.displayName,
        },
      },
    };
  }
}
