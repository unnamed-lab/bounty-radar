import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BountyRepository } from './bounty.repository';

@Global()
@Module({
  providers: [PrismaService, BountyRepository],
  exports: [PrismaService, BountyRepository],
})
export class PersistenceModule {}
