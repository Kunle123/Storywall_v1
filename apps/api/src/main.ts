import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { API_CONTRACT_VERSION } from "@storywall/shared";

/** Staging frontend (Railway); additional origins via comma-separated `CORS_ORIGIN`. */
const STAGING_FRONTEND_ORIGIN = "https://frontend-staging-423b.up.railway.app";

function corsAllowedOrigins(): string[] {
  const extra =
    process.env.CORS_ORIGIN?.split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0) ?? [];
  return Array.from(new Set([STAGING_FRONTEND_ORIGIN, ...extra]));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsAllowedOrigins(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "If-Match"],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Storywall API listening on ${port} (api_version ${API_CONTRACT_VERSION})`);
}

void bootstrap();
