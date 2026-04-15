import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import type { RegisterDto } from "./dto/register.dto";

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.creator.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException({
        ok: false,
        error: { code: "email_in_use", message: "Email already registered" },
      });
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const creator = await this.prisma.creator.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.displayName ?? null,
      },
      select: { id: true, email: true, displayName: true },
    });
    return { creator, accessToken: this.signAccessToken(creator) };
  }

  async login(email: string, password: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, displayName: true, passwordHash: true },
    });
    if (!creator?.passwordHash) {
      throw new UnauthorizedException({
        ok: false,
        error: {
          code: "invalid_credentials",
          message:
            "Invalid email or password (legacy accounts may need password setup)",
        },
      });
    }
    const ok = await bcrypt.compare(password, creator.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        ok: false,
        error: { code: "invalid_credentials", message: "Invalid email or password" },
      });
    }
    const { passwordHash: _, ...rest } = creator;
    return { creator: rest, accessToken: this.signAccessToken(rest) };
  }

  private signAccessToken(creator: {
    id: string;
    email: string;
    displayName: string | null;
  }): string {
    return this.jwt.sign({ sub: creator.id, email: creator.email });
  }
}
