import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const RETRIES = 5;
const BASE_DELAY_MS = 2000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPrismaConnectionError(err: any): boolean {
  return (
    err?.code === 'P1001' ||
    err?.code === 'P1002' ||
    err?.code === 'P1017' ||
    err?.message?.includes('Can\'t reach database server') ||
    err?.message?.includes('Connection timed out') ||
    err?.message?.includes('Connection refused')
  );
}

function buildDatabaseUrl(base: string): string {
  if (!base || base.includes('connection_limit')) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}connection_limit=1&pool_timeout=30&connect_timeout=30`;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ datasourceUrl: buildDatabaseUrl(process.env.DATABASE_URL ?? '') });
  }

  async onModuleInit() {
    await this.connectWithRetry();
    this.startKeepalive();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry(): Promise<void> {
    for (let i = 0; i < RETRIES; i++) {
      try {
        await this.$connect();
        this.logger.log('Database connected');
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (i < RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, i);
          this.logger.warn(`DB connect attempt ${i + 1} failed: ${msg}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          this.logger.error(`DB connect failed after ${RETRIES} attempts: ${msg}`);
          throw err;
        }
      }
    }
  }

  private startKeepalive(): void {
    setInterval(async () => {
      try {
        await this.$queryRaw`SELECT 1`;
      } catch {
        this.logger.warn('Keepalive ping failed, attempting reconnect...');
        for (let i = 0; i < RETRIES; i++) {
          try {
            await this.$disconnect();
          } catch {}
          try {
            await this.$connect();
            this.logger.log('Database reconnected');
            return;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (i < RETRIES - 1) {
              await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, i)));
            } else {
              this.logger.error(`Reconnect failed after ${RETRIES} attempts: ${msg}`);
            }
          }
        }
      }
    }, 60_000);
  }

  async runQueryRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      if (isPrismaConnectionError(err) && attempt < 3) {
        const delay = 1000 * Math.pow(2, attempt);
        this.logger.warn(`Query failed with connection error, retry ${attempt + 1}/3 in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return this.runQueryRetry(fn, attempt + 1);
      }
      throw err;
    }
  }
}
