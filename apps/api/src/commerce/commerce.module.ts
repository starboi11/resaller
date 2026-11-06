import { Module } from '@nestjs/common';
import { CommerceController } from './commerce.controller.js';
import { CommerceService } from './commerce.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OwnerStoreCheck } from '../owner/owner-store-check.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CommerceController],
  providers: [CommerceService, OwnerStoreCheck],
})
export class CommerceModule {}
