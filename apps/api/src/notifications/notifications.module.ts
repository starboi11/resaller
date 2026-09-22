import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { EndpointCryptoService } from './endpoint-crypto.service.js';
import { NotificationProviderService } from './notification-provider.service.js';
import { NotificationQueueService } from './notification-queue.service.js';

@Module({ imports: [forwardRef(() => AuthModule)], controllers: [NotificationsController], providers: [NotificationsService, EndpointCryptoService, NotificationProviderService, NotificationQueueService], exports: [NotificationsService, NotificationQueueService, EndpointCryptoService, NotificationProviderService] })
export class NotificationsModule {}
