import { Module } from '@nestjs/common';
import { ConfigModule as NestConfig } from '@nestjs/config';
import { validateEnv } from './env.validation';

@Module({
  imports: [NestConfig.forRoot({ isGlobal: true, validate: validateEnv })],
})
export class ConfigModule {}
