import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedCreator } from "./types";

export const CurrentCreator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedCreator => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthenticatedCreator }>();
    return req.user;
  },
);
