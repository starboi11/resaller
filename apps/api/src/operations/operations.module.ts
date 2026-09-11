import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';
import { OrderTimeoutService } from './order-timeout.service.js';

@Module({ imports: [AuthModule], controllers: [OperationsController], providers: [OperationsService, OrderTimeoutService] })
export class OperationsModule {}
