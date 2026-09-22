import { forwardRef, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PasswordService } from './password.service.js';
import { SessionTokenService } from './session-token.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './session.guard.js';
import { TotpService } from './totp.service.js';
import { PasswordResetDeliveryService } from './password-reset-delivery.service.js';

@Module({ imports: [forwardRef(() => NotificationsModule)], controllers: [AuthController], providers: [PasswordService, SessionTokenService, TotpService, PasswordResetDeliveryService, AuthService, SessionGuard], exports: [PasswordService, SessionTokenService, AuthService, SessionGuard] })
export class AuthModule {}
