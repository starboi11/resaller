import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TrustController } from './trust.controller.js';
import { TrustService } from './trust.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
