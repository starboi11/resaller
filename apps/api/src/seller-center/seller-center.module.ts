import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SellerCenterController } from './seller-center.controller.js';
import { SellerCenterService } from './seller-center.service.js';

@Module({ imports: [AuthModule, NotificationsModule], controllers: [SellerCenterController], providers: [SellerCenterService] })
export class SellerCenterModule {}
