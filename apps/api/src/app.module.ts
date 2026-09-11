import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { PlatformController } from './platform/platform.controller.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { AdminModule } from './admin/admin.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { MediaModule } from './media/media.module.js';

@Module({
  imports: [InfrastructureModule, AuthModule, CommerceModule, OperationsModule, AdminModule, NotificationsModule, MediaModule],
  controllers: [HealthController, PlatformController],
})
export class AppModule {}
