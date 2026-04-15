import { Body, Controller, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: RegisterDto) {
    const { creator, accessToken } = await this.auth.register(body);
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        access_token: accessToken,
        token_type: "bearer" as const,
        creator: {
          id: creator.id,
          email: creator.email,
          display_name: creator.displayName,
        },
      },
    };
  }

  @Post("login")
  async login(@Body() body: LoginDto) {
    const { creator, accessToken } = await this.auth.login(body.email, body.password);
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        access_token: accessToken,
        token_type: "bearer" as const,
        creator: {
          id: creator.id,
          email: creator.email,
          display_name: creator.displayName,
        },
      },
    };
  }
}
