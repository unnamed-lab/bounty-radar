import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsString() TG_TOKEN!: string;
  @IsString() TG_CHAT_ID!: string;
  @IsString() DATABASE_URL!: string;

  @IsOptional() @IsString() X_HANDLE?: string;
  @IsOptional() @IsString() TG_CHANNEL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Invalid environment:\n${errors.toString()}`);
  }
  return config; // return full config so cron/TZ vars remain available
}
